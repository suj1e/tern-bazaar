--!strict
-- Pairing belongs to this window VM; no files, saved state, or shell text.
local companions: { [number]: number } = {}
local sources: { [number]: number } = {}

local function open_sidecar(cx: WindowCx, direction: Dir)
	local focused = cx.session:focused()
	if focused == nil then
		cx:toast("info", "Focus a pane before opening a sidecar")
		return
	end
	local source = sources[focused] or focused
	local companion = companions[source]
	if companion ~= nil then
		cx.layout:focus(companion)
		return
	end
	-- Omitting launch inherits the source pane's host and working directory.
	-- This opens an ordinary interactive shell, not a process launched by Lua.
	local pane = cx.layout:split(source, direction)
	if pane == nil then
		cx:toast("error", "Could not open a sidecar", "The source pane is no longer in a tab.")
		return
	end
	companions[source] = pane
	sources[pane] = source
	cx:toast("success", "Sidecar opened", "Use Switch between paired panes to return to your work.")
end

tern.command({
	id = "open_right",
	title = "Open or focus sidecar on the right",
	icon = "terminal",
	run = function(cx)
		open_sidecar(cx, "right")
	end,
})

tern.command({
	id = "open_below",
	title = "Open or focus sidecar below",
	icon = "terminal",
	run = function(cx)
		open_sidecar(cx, "down")
	end,
})

tern.command({
	id = "switch_pair",
	title = "Switch between paired panes",
	icon = "terminal",
	keys = { "ctrl+alt+shift+j" },
	run = function(cx)
		local focused = cx.session:focused()
		if focused == nil then
			cx:toast("info", "Focus a paired pane first")
			return
		end
		local target = sources[focused] or companions[focused]
		if target == nil then
			cx:toast("info", "This pane has no sidecar", "Run Open or focus sidecar on the right, or below, first.")
			return
		end
		cx.layout:focus(target)
	end,
})

tern.on("pane_closed", function(ev, _cx)
	local companion = companions[ev.pane]
	if companion ~= nil then
		sources[companion] = nil
		companions[ev.pane] = nil
	end
	local source = sources[ev.pane]
	if source ~= nil then
		companions[source] = nil
		sources[ev.pane] = nil
	end
end)
