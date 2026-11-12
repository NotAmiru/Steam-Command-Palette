local logger     = require("logger")
local millennium = require("millennium")

-- RPC functions (---@ffi) live in rpc_functions.lua
require("rpc_functions")

local function on_load()
    logger:info("Command palette loaded with Millennium " .. millennium.version())
    millennium.ready()
end

-- may not run if Steam crashes or is force-closed; nothing critical happens here
local function on_unload()
    logger:info("Command palette unloaded")
end

local function on_frontend_loaded()
    logger:info("Frontend loaded")
end

return {
    on_load = on_load,
    on_unload = on_unload,
    on_frontend_loaded = on_frontend_loaded,
}
