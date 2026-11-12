local logger = require("logger")

-- Hidden process runner (LuaJIT FFI, Windows). Falls back to os.execute elsewhere.
local ffi_ok, ffi = pcall(require, "ffi")
local kernel32 = nil
local is_win = package.config:sub(1, 1) == "\\"

if is_win and ffi_ok and ffi then
    pcall(function()
        ffi.cdef[[
        typedef unsigned long DWORD; typedef int BOOL; typedef void* HANDLE;
        typedef const char* LPCSTR; typedef char* LPSTR;
        typedef struct _SECURITY_ATTRIBUTES { DWORD nLength; void* lpSecurityDescriptor; BOOL bInheritHandle; } SECURITY_ATTRIBUTES, *LPSECURITY_ATTRIBUTES;
        typedef struct _STARTUPINFOA {
            DWORD cb; LPSTR lpReserved; LPSTR lpDesktop; LPSTR lpTitle;
            DWORD dwX; DWORD dwY; DWORD dwXSize; DWORD dwYSize; DWORD dwXCountChars; DWORD dwYCountChars;
            DWORD dwFillAttribute; DWORD dwFlags; short wShowWindow; short cbReserved2; void* lpReserved2;
            HANDLE hStdInput; HANDLE hStdOutput; HANDLE hStdError;
        } STARTUPINFOA, *LPSTARTUPINFOA;
        typedef struct _PROCESS_INFORMATION { HANDLE hProcess; HANDLE hThread; DWORD dwProcessId; DWORD dwThreadId; } PROCESS_INFORMATION, *LPPROCESS_INFORMATION;
        BOOL CreateProcessA(LPCSTR lpApplicationName, LPSTR lpCommandLine, LPSECURITY_ATTRIBUTES lpProcessAttributes,
            LPSECURITY_ATTRIBUTES lpThreadAttributes, BOOL bInheritHandles, DWORD dwCreationFlags, void* lpEnvironment,
            LPCSTR lpCurrentDirectory, LPSTARTUPINFOA lpStartupInfo, LPPROCESS_INFORMATION lpProcessInformation);
        DWORD WaitForSingleObject(HANDLE hHandle, DWORD dwMilliseconds);
        BOOL CloseHandle(HANDLE hObject);
        ]]
    end) -- a second load redefines the types; that error is harmless
    local loaded, lib = pcall(ffi.load, "kernel32")
    if loaded then kernel32 = lib end
end

local CREATE_NO_WINDOW, STARTF_USESHOWWINDOW, SW_HIDE = 0x08000000, 0x00000001, 0

local function run_silent(cmd_line, wait_ms)
    if kernel32 and ffi then
        local si = ffi.new("STARTUPINFOA"); si.cb = ffi.sizeof("STARTUPINFOA")
        si.dwFlags = STARTF_USESHOWWINDOW; si.wShowWindow = SW_HIDE
        local pi = ffi.new("PROCESS_INFORMATION")
        local buf = ffi.new("char[?]", #cmd_line + 1); ffi.copy(buf, cmd_line)
        local ok = kernel32.CreateProcessA(nil, buf, nil, nil, 0, CREATE_NO_WINDOW, nil, nil, si, pi)
        if ok == 0 then return false end
        if wait_ms and wait_ms > 0 then kernel32.WaitForSingleObject(pi.hProcess, wait_ms) end
        kernel32.CloseHandle(pi.hThread); kernel32.CloseHandle(pi.hProcess)
        return true
    end
    pcall(os.execute, cmd_line)
    return true
end

local counter = 0

--- Search the Steam store via curl (fallback when the frontend can't fetch it directly).
--- `term` must already be URL-encoded; anything outside [A-Za-z0-9%-._~] is rejected,
--- so nothing the user types can reach the command line unescaped.
---@ffi
---@param term string
---@param cc string
---@return string
function search_store(term, cc)
    if type(term) ~= "string" or term == "" or #term > 200 or term:find("[^%w%%%-%._~]") then
        return '{"error":"bad_term"}'
    end
    if type(cc) ~= "string" or not cc:match("^%a%a$") then cc = nil end -- nil: let the store pick by IP

    local sep = is_win and "\\" or "/"
    local tmp = os.getenv("TEMP") or os.getenv("TMP") or (not is_win and "/tmp" or nil)
    if not tmp then return '{"error":"no_temp_dir"}' end

    counter = counter + 1
    local out = tmp .. sep .. "mcp_store_" .. os.time() .. "_" .. counter .. ".json"
    local url = "https://store.steampowered.com/api/storesearch/?term=" .. term .. "&l=english" .. (cc and ("&cc=" .. cc:lower()) or "")
    local curl = is_win and "curl.exe" or "curl"
    local cmd = curl .. ' -s -m 6 -o "' .. out .. '" "' .. url .. '"'

    if not run_silent(cmd, 7000) then return '{"error":"spawn_failed"}' end

    local f = io.open(out, "rb")
    if not f then return '{"error":"no_output"}' end
    local body = f:read("*a")
    f:close()
    os.remove(out)

    if not body or body == "" then return '{"error":"empty_response"}' end
    return body
end

logger:info("Registered RPC functions")
