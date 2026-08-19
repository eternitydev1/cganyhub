--[[
    ═══════════════════════════════════════════════════════════════
                    CIGANYHUB — KEY SYSTEM GUI
    ═══════════════════════════════════════════════════════════════
    Domain: https://cganyhub.vercel.app
]]

local VERCEL_DOMAIN = "https://cganyhub.vercel.app"
local DISCORD_INVITE = "https://discord.gg/yourserver"
local KEY_FILE = "ciganyhub_key.json"

local CoreGui = game:GetService("CoreGui")
local TweenService = game:GetService("TweenService")
local HttpService = game:GetService("HttpService")
local RbxAnalyticsService = game:GetService("RbxAnalyticsService")

-- Cleanup old GUI instance
if CoreGui:FindFirstChild("CiganyKeySystem") then
    CoreGui.CiganyKeySystem:Destroy()
end

-- Get Unique Hardware ID (HWID)
local function getClientHWID()
    local hwid = nil
    if gethwid then
        hwid = gethwid()
    elseif get_hwid then
        hwid = get_hwid()
    elseif getexecutorhwid then
        hwid = getexecutorhwid()
    end

    if not hwid or #tostring(hwid) < 4 then
        pcall(function()
            hwid = RbxAnalyticsService:GetClientId()
        end)
    end

    if not hwid or #tostring(hwid) < 4 then
        local lp = game:GetService("Players").LocalPlayer
        hwid = lp and tostring(lp.UserId) or "fallback_hwid_device"
    end

    return tostring(hwid):gsub("%s+", "")
end

local MY_HWID = getClientHWID()

-- Cross-executor HTTP request
local function performHttpRequest(url, headers)
    headers = headers or {}
    headers["X-HWID"] = MY_HWID

    if syn and syn.request then
        local res = syn.request({Url = url, Method = "GET", Headers = headers})
        return res.Body, res.StatusCode
    elseif http and http.request then
        local res = http.request({Url = url, Method = "GET", Headers = headers})
        return res.Body, res.StatusCode
    elseif request then
        local res = request({Url = url, Method = "GET", Headers = headers})
        return res.Body, res.StatusCode
    else
        local success, body = pcall(function() return game:HttpGet(url) end)
        return body, success and 200 or 400
    end
end

-- Safe setclipboard
local function safeSetClipboard(str)
    if setclipboard then
        setclipboard(str)
        return true
    elseif toclipboard then
        toclipboard(str)
        return true
    end
    return false
end

-- Local Key Storage
local function getSavedKeyData()
    if isfile and readfile and isfile(KEY_FILE) then
        local content = readfile(KEY_FILE)
        if content and #content > 5 then
            local ok, parsed = pcall(function() return HttpService:JSONDecode(content) end)
            if ok and parsed and parsed.key then
                return parsed.key
            else
                return content:gsub('["\r\n ]', '')
            end
        end
    end
    return nil
end

local function saveKeyLocally(key)
    if writefile then
        local payload = HttpService:JSONEncode({
            key = key,
            hwid = MY_HWID,
            savedAt = os.time()
        })
        pcall(function() writefile(KEY_FILE, payload) end)
    end
end

-- Create ScreenGui
local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Name = "CiganyKeySystem"
ScreenGui.ResetOnSpawn = false
if syn and syn.protect_gui then
    syn.protect_gui(ScreenGui)
    ScreenGui.Parent = CoreGui
elseif gethui then
    ScreenGui.Parent = gethui()
else
    ScreenGui.Parent = CoreGui
end

-- Main Frame (Obsidian & Crimson Red)
local MainFrame = Instance.new("Frame")
MainFrame.Name = "MainFrame"
MainFrame.Size = UDim2.new(0, 440, 0, 300)
MainFrame.Position = UDim2.new(0.5, -220, 0.5, -150)
MainFrame.BackgroundColor3 = Color3.fromRGB(8, 7, 14)
MainFrame.BorderSizePixel = 0
MainFrame.ClipsDescendants = true
MainFrame.Active = true
MainFrame.Draggable = true
MainFrame.Parent = ScreenGui

local UICorner = Instance.new("UICorner")
UICorner.CornerRadius = UDim.new(0, 14)
UICorner.Parent = MainFrame

local UIStroke = Instance.new("UIStroke")
UIStroke.Color = Color3.fromRGB(255, 30, 39)
UIStroke.Thickness = 1.5
UIStroke.Transparency = 0.35
UIStroke.Parent = MainFrame

-- Header
local Header = Instance.new("Frame")
Header.Size = UDim2.new(1, 0, 0, 46)
Header.BackgroundColor3 = Color3.fromRGB(14, 12, 24)
Header.BorderSizePixel = 0
Header.Parent = MainFrame

local HeaderCorner = Instance.new("UICorner")
HeaderCorner.CornerRadius = UDim.new(0, 14)
HeaderCorner.Parent = Header

local Title = Instance.new("TextLabel")
Title.Text = "CIGANY<font color='#ff1e27'>HUB</font> — KEY VERIFICATION"
Title.RichText = true
Title.Font = Enum.Font.GothamBold
Title.TextSize = 14
Title.TextColor3 = Color3.fromRGB(255, 255, 255)
Title.Position = UDim2.new(0, 16, 0, 0)
Title.Size = UDim2.new(1, -60, 1, 0)
Title.TextXAlignment = Enum.TextXAlignment.Left
Title.BackgroundTransparency = 1
Title.Parent = Header

local CloseBtn = Instance.new("TextButton")
CloseBtn.Text = "×"
CloseBtn.Font = Enum.Font.GothamBold
CloseBtn.TextSize = 20
CloseBtn.TextColor3 = Color3.fromRGB(160, 160, 180)
CloseBtn.Position = UDim2.new(1, -38, 0, 8)
CloseBtn.Size = UDim2.new(0, 30, 0, 30)
CloseBtn.BackgroundTransparency = 1
CloseBtn.Parent = Header
CloseBtn.MouseButton1Click:Connect(function()
    ScreenGui:Destroy()
end)

-- Subtitle & HWID info
local Subtitle = Instance.new("TextLabel")
Subtitle.Text = "Each 8-hour key is locked to 1 device (HWID). Complete the gateway to get your key."
Subtitle.Font = Enum.Font.Gotham
Subtitle.TextSize = 12
Subtitle.TextColor3 = Color3.fromRGB(161, 161, 187)
Subtitle.TextWrapped = true
Subtitle.Position = UDim2.new(0, 20, 0, 56)
Subtitle.Size = UDim2.new(1, -40, 0, 30)
Subtitle.BackgroundTransparency = 1
Subtitle.Parent = MainFrame

-- Key Input TextBox
local InputBox = Instance.new("TextBox")
InputBox.PlaceholderText = "Paste your 8-hour key here (KEY_...)"
InputBox.PlaceholderColor3 = Color3.fromRGB(90, 90, 115)
InputBox.Text = ""
InputBox.Font = Enum.Font.Code
InputBox.TextSize = 11
InputBox.TextColor3 = Color3.fromRGB(125, 211, 252)
InputBox.BackgroundColor3 = Color3.fromRGB(4, 3, 8)
InputBox.Position = UDim2.new(0, 20, 0, 94)
InputBox.Size = UDim2.new(1, -40, 0, 42)
InputBox.ClearTextOnFocus = false
InputBox.Parent = MainFrame

local BoxCorner = Instance.new("UICorner")
BoxCorner.CornerRadius = UDim.new(0, 8)
BoxCorner.Parent = InputBox

local BoxStroke = Instance.new("UIStroke")
BoxStroke.Color = Color3.fromRGB(45, 35, 60)
BoxStroke.Parent = InputBox

-- Status Text
local StatusLabel = Instance.new("TextLabel")
StatusLabel.Text = ""
StatusLabel.Font = Enum.Font.GothamMedium
StatusLabel.TextSize = 11
StatusLabel.Position = UDim2.new(0, 20, 0, 142)
StatusLabel.Size = UDim2.new(1, -40, 0, 20)
StatusLabel.BackgroundTransparency = 1
StatusLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
StatusLabel.Parent = MainFrame

-- Button Helper
local function makeButton(text, pos, size, bgCol, borderCol, callback)
    local btn = Instance.new("TextButton")
    btn.Text = text
    btn.Font = Enum.Font.GothamBold
    btn.TextSize = 12
    btn.TextColor3 = Color3.fromRGB(255, 255, 255)
    btn.BackgroundColor3 = bgCol
    btn.Position = pos
    btn.Size = size
    btn.Parent = MainFrame
    
    local c = Instance.new("UICorner")
    c.CornerRadius = UDim.new(0, 8)
    c.Parent = btn

    if borderCol then
        local s = Instance.new("UIStroke")
        s.Color = borderCol
        s.Thickness = 1
        s.Parent = btn
    end

    btn.MouseButton1Click:Connect(callback)
    return btn
end

-- Loader execution
local function loadScript(scriptContent)
    StatusLabel.TextColor3 = Color3.fromRGB(34, 197, 94)
    StatusLabel.Text = "Key Verified & HWID Bound. Loading CiganyHub..."
    task.wait(0.5)
    ScreenGui:Destroy()
    
    local func, err = loadstring(scriptContent)
    if func then
        func()
    else
        warn("[CiganyHub Error] " .. tostring(err))
    end
end

-- Key verification
local function verifyKey(keyToVerify, isAutoCheck)
    if not keyToVerify or #keyToVerify < 5 then
        if not isAutoCheck then
            StatusLabel.TextColor3 = Color3.fromRGB(255, 107, 114)
            StatusLabel.Text = "Please enter a valid key."
        end
        return
    end

    StatusLabel.TextColor3 = Color3.fromRGB(255, 30, 39)
    StatusLabel.Text = "Verifying key & HWID with server..."

    task.spawn(function()
        local url = VERCEL_DOMAIN .. "/api/get-script?key=" .. HttpService:UrlEncode(keyToVerify) .. "&hwid=" .. HttpService:UrlEncode(MY_HWID)
        local body, status = performHttpRequest(url)

        if status == 200 and body and not string.find(body, "403 Forbidden") and not string.find(body, "401 Unauthorized") then
            saveKeyLocally(keyToVerify)
            loadScript(body)
        else
            if string.find(body or "", "different Hardware ID") then
                StatusLabel.TextColor3 = Color3.fromRGB(255, 107, 114)
                StatusLabel.Text = "This key is locked to another HWID."
            else
                StatusLabel.TextColor3 = Color3.fromRGB(255, 107, 114)
                StatusLabel.Text = "Invalid or expired key. Click 'Get Key' below."
            end
        end
    end)
end

-- Verify Key Button (Crimson Red)
makeButton("VERIFY KEY", UDim2.new(0, 20, 0, 172), UDim2.new(1, -40, 0, 42), Color3.fromRGB(255, 30, 39), Color3.fromRGB(255, 60, 70), function()
    verifyKey(InputBox.Text:gsub("%s+", ""), false)
end)

-- Get Key Button (Opens / Copies Vercel Link)
makeButton("GET KEY (LOOTLABS)", UDim2.new(0, 20, 0, 226), UDim2.new(0.48, -10, 0, 38), Color3.fromRGB(20, 16, 35), Color3.fromRGB(60, 45, 80), function()
    safeSetClipboard(VERCEL_DOMAIN)
    StatusLabel.TextColor3 = Color3.fromRGB(125, 211, 252)
    StatusLabel.Text = "Gateway link copied: https://cganyhub.vercel.app/"
end)

-- Discord Button
makeButton("DISCORD", UDim2.new(0.52, 0, 0, 226), UDim2.new(0.48, -10, 0, 38), Color3.fromRGB(88, 101, 242), Color3.fromRGB(120, 130, 255), function()
    safeSetClipboard(DISCORD_INVITE)
    StatusLabel.TextColor3 = Color3.fromRGB(165, 180, 252)
    StatusLabel.Text = "Discord invite copied to clipboard."
end)

-- Auto-check saved key on startup (Auto-loads if < 8 hours and same HWID)
task.spawn(function()
    local saved = getSavedKeyData()
    if saved and #saved > 5 then
        InputBox.Text = saved
        StatusLabel.TextColor3 = Color3.fromRGB(255, 30, 39)
        StatusLabel.Text = "Found saved key. Checking 8-hour session..."
        verifyKey(saved, true)
    end
end)
