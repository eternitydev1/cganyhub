--[[
    ═══════════════════════════════════════════════════════════════
                    CIGANYHUB — KEY SYSTEM GUI
    ═══════════════════════════════════════════════════════════════
    Deploy your Vercel project and replace VERCEL_DOMAIN below!
]]

local VERCEL_DOMAIN = "https://your-project-name.vercel.app" -- Replace with your actual Vercel URL
local DISCORD_INVITE = "https://discord.gg/yourserver"
local KEY_FILE = "ciganyhub_key.json"

local CoreGui = game:GetService("CoreGui")
local TweenService = game:GetService("TweenService")
local HttpService = game:GetService("HttpService")

-- Cleanup old GUI instance if exists
if CoreGui:FindFirstChild("CiganyKeySystem") then
    CoreGui.CiganyKeySystem:Destroy()
end

-- Helper: HTTP Request function cross-executor compatibility
local function performHttpRequest(url)
    if syn and syn.request then
        local res = syn.request({Url = url, Method = "GET"})
        return res.Body, res.StatusCode
    elseif http and http.request then
        local res = http.request({Url = url, Method = "GET"})
        return res.Body, res.StatusCode
    elseif request then
        local res = request({Url = url, Method = "GET"})
        return res.Body, res.StatusCode
    else
        local success, body = pcall(function() return game:HttpGet(url) end)
        return body, success and 200 or 400
    end
end

-- Helper: Safe setclipboard
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

-- Check if saved key is still valid (8 hours)
local function getSavedKey()
    if isfile and readfile and isfile(KEY_FILE) then
        local content = readfile(KEY_FILE)
        if content and #content > 0 then
            return content
        end
    end
    return nil
end

local function saveKeyLocally(key)
    if writefile then
        pcall(function() writefile(KEY_FILE, key) end)
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

-- Main Frame
local MainFrame = Instance.new("Frame")
MainFrame.Name = "MainFrame"
MainFrame.Size = UDim2.new(0, 420, 0, 290)
MainFrame.Position = UDim2.new(0.5, -210, 0.5, -145)
MainFrame.BackgroundColor3 = Color3.fromRGB(15, 17, 26)
MainFrame.BorderSizePixel = 0
MainFrame.ClipsDescendants = true
MainFrame.Parent = ScreenGui

local UICorner = Instance.new("UICorner")
UICorner.CornerRadius = UDim.new(0, 16)
UICorner.Parent = MainFrame

local UIStroke = Instance.new("UIStroke")
UIStroke.Color = Color3.fromRGB(99, 102, 241)
UIStroke.Thickness = 1.5
UIStroke.Transparency = 0.4
UIStroke.Parent = MainFrame

-- Header Bar
local Header = Instance.new("Frame")
Header.Size = UDim2.new(1, 0, 0, 45)
Header.BackgroundColor3 = Color3.fromRGB(20, 24, 38)
Header.BorderSizePixel = 0
Header.Parent = MainFrame

local HeaderCorner = Instance.new("UICorner")
HeaderCorner.CornerRadius = UDim.new(0, 16)
HeaderCorner.Parent = Header

local Title = Instance.new("TextLabel")
Title.Text = "CIGANYHUB <font color='#818cf8'>KEY SYSTEM</font>"
Title.RichText = true
Title.Font = Enum.Font.GothamBold
Title.TextSize = 15
Title.TextColor3 = Color3.fromRGB(240, 240, 250)
Title.Position = UDim2.new(0, 16, 0, 0)
Title.Size = UDim2.new(1, -60, 1, 0)
Title.TextXAlignment = Enum.TextXAlignment.Left
Title.BackgroundTransparency = 1
Title.Parent = Header

-- Close Button
local CloseBtn = Instance.new("TextButton")
CloseBtn.Text = "×"
CloseBtn.Font = Enum.Font.GothamBold
CloseBtn.TextSize = 20
CloseBtn.TextColor3 = Color3.fromRGB(150, 150, 160)
CloseBtn.Position = UDim2.new(1, -38, 0, 6)
CloseBtn.Size = UDim2.new(0, 30, 0, 30)
CloseBtn.BackgroundTransparency = 1
CloseBtn.Parent = Header
CloseBtn.MouseButton1Click:Connect(function()
    ScreenGui:Destroy()
end)

-- Content Section
local InfoText = Instance.new("TextLabel")
InfoText.Text = "Please enter your 8-hour session key below or generate a new one from our website."
InfoText.Font = Enum.Font.Gotham
InfoText.TextSize = 12
InfoText.TextColor3 = Color3.fromRGB(160, 165, 185)
InfoText.TextWrapped = true
InfoText.Position = UDim2.new(0, 20, 0, 58)
InfoText.Size = UDim2.new(1, -40, 0, 32)
InfoText.BackgroundTransparency = 1
InfoText.Parent = MainFrame

-- Key Input TextBox
local InputBox = Instance.new("TextBox")
InputBox.PlaceholderText = "Paste KEY_... here"
InputBox.PlaceholderColor3 = Color3.fromRGB(100, 105, 125)
InputBox.Text = ""
InputBox.Font = Enum.Font.Code
InputBox.TextSize = 12
InputBox.TextColor3 = Color3.fromRGB(56, 189, 248)
InputBox.BackgroundColor3 = Color3.fromRGB(10, 11, 18)
InputBox.Position = UDim2.new(0, 20, 0, 98)
InputBox.Size = UDim2.new(1, -40, 0, 40)
InputBox.ClearTextOnFocus = false
InputBox.Parent = MainFrame

local BoxCorner = Instance.new("UICorner")
BoxCorner.CornerRadius = UDim.new(0, 8)
BoxCorner.Parent = InputBox

local BoxStroke = Instance.new("UIStroke")
BoxStroke.Color = Color3.fromRGB(45, 50, 75)
BoxStroke.Parent = InputBox

-- Status Label
local StatusLabel = Instance.new("TextLabel")
StatusLabel.Text = ""
StatusLabel.Font = Enum.Font.GothamMedium
StatusLabel.TextSize = 11
StatusLabel.Position = UDim2.new(0, 20, 0, 142)
StatusLabel.Size = UDim2.new(1, -40, 0, 20)
StatusLabel.BackgroundTransparency = 1
StatusLabel.TextColor3 = Color3.fromRGB(240, 240, 250)
StatusLabel.Parent = MainFrame

-- Button Factory
local function makeButton(text, pos, size, bgCol, callback)
    local btn = Instance.new("TextButton")
    btn.Text = text
    btn.Font = Enum.Font.GothamBold
    btn.TextSize = 13
    btn.TextColor3 = Color3.fromRGB(255, 255, 255)
    btn.BackgroundColor3 = bgCol
    btn.Position = pos
    btn.Size = size
    btn.Parent = MainFrame
    
    local c = Instance.new("UICorner")
    c.CornerRadius = UDim.new(0, 8)
    c.Parent = btn

    btn.MouseButton1Click:Connect(callback)
    return btn
end

-- Action: Execute main loader
local function loadScript(scriptContent)
    StatusLabel.TextColor3 = Color3.fromRGB(52, 211, 153)
    StatusLabel.Text = "✅ Key verified! Loading CiganyHUB..."
    task.wait(0.6)
    ScreenGui:Destroy()
    
    local func, err = loadstring(scriptContent)
    if func then
        func()
    else
        warn("[CiganyHUB Error] " .. tostring(err))
    end
end

-- Action: Verify Key
local function verifyKey(keyToVerify)
    if not keyToVerify or #keyToVerify < 5 then
        StatusLabel.TextColor3 = Color3.fromRGB(248, 113, 113)
        StatusLabel.Text = "❌ Please enter a valid key."
        return
    end

    StatusLabel.TextColor3 = Color3.fromRGB(99, 102, 241)
    StatusLabel.Text = "⏳ Contacting Vercel server..."

    task.spawn(function()
        local url = VERCEL_DOMAIN .. "/api/get-script?key=" .. HttpService:UrlEncode(keyToVerify)
        local body, status = performHttpRequest(url)

        if status == 200 and body and not string.find(body, "403 Forbidden") and not string.find(body, "401 Unauthorized") then
            saveKeyLocally(keyToVerify)
            loadScript(body)
        else
            StatusLabel.TextColor3 = Color3.fromRGB(248, 113, 113)
            StatusLabel.Text = "❌ Invalid or expired key. Please get a new one."
        end
    end)
end

-- "Verify Key" Button
makeButton("Verify Key", UDim2.new(0, 20, 0, 172), UDim2.new(1, -40, 0, 38), Color3.fromRGB(99, 102, 241), function()
    verifyKey(InputBox.Text:gsub("%s+", ""))
end)

-- "Get Key" Button (Copies link to clipboard)
makeButton("🔗 Get Key", UDim2.new(0, 20, 0, 222), UDim2.new(0.48, -10, 0, 36), Color3.fromRGB(30, 35, 55), function()
    safeSetClipboard(VERCEL_DOMAIN)
    StatusLabel.TextColor3 = Color3.fromRGB(56, 189, 248)
    StatusLabel.Text = "📋 Key website copied to clipboard!"
end)

-- "Discord" Button
makeButton("💬 Discord", UDim2.new(0.52, 0, 0, 222), UDim2.new(0.48, -10, 0, 36), Color3.fromRGB(88, 101, 242), function()
    safeSetClipboard(DISCORD_INVITE)
    StatusLabel.TextColor3 = Color3.fromRGB(165, 180, 252)
    StatusLabel.Text = "📋 Discord invite copied to clipboard!"
end)

-- Auto-check saved key on startup
task.spawn(function()
    local saved = getSavedKey()
    if saved and #saved > 5 then
        InputBox.Text = saved
        StatusLabel.TextColor3 = Color3.fromRGB(99, 102, 241)
        StatusLabel.Text = "Checking saved 8-hour key..."
        verifyKey(saved)
    end
end)
