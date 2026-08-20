--[[
    ═══════════════════════════════════════════════════════════════
                    CIGANYHUB — KEY SYSTEM GUI
    ═══════════════════════════════════════════════════════════════
    Domain: https://cganyhub.vercel.app
]]

local VERCEL_DOMAIN  = "https://cganyhub.vercel.app"
local DISCORD_INVITE = "https://dsc.gg/ciganyhub"
local KEY_FILE       = "ciganyhub_key.json"

-- ════════════════════════════════════════════════════════
-- SERVICES
-- ════════════════════════════════════════════════════════
local Players             = game:GetService("Players")
local TweenService        = game:GetService("TweenService")
local UIS                 = game:GetService("UserInputService")
local Lighting            = game:GetService("Lighting")
local CoreGui             = game:GetService("CoreGui")
local HttpService         = game:GetService("HttpService")
local RbxAnalyticsService = game:GetService("RbxAnalyticsService")
local lp                  = Players.LocalPlayer

local isMobile = UIS.TouchEnabled and not UIS.KeyboardEnabled

-- ════════════════════════════════════════════════════════
-- PALETTE
-- ════════════════════════════════════════════════════════
local C = {
    bg0     = Color3.fromRGB(6,   7,  10),
    bg1     = Color3.fromRGB(11,  12, 16),
    bg2     = Color3.fromRGB(16,  18, 23),
    bg3     = Color3.fromRGB(22,  25, 32),
    bg4     = Color3.fromRGB(28,  32, 40),
    brd     = Color3.fromRGB(36,  39, 48),
    brd2    = Color3.fromRGB(48,  52, 64),
    acc     = Color3.fromRGB(255, 30, 39),
    accDark = Color3.fromRGB(160, 20, 28),
    accGlow = Color3.fromRGB(255, 75, 84),
    grn     = Color3.fromRGB(65,  195, 115),
    txt     = Color3.fromRGB(198, 201, 215),
    txt2    = Color3.fromRGB(140, 144, 162),
    txt3    = Color3.fromRGB(80,  83,  100),
    white   = Color3.fromRGB(255, 255, 255),
    black   = Color3.fromRGB(0,   0,   0),
    gold    = Color3.fromRGB(235, 175, 35),
    goldDk  = Color3.fromRGB(175, 128, 18),
    dcBlue  = Color3.fromRGB(114, 137, 218),
}

-- ════════════════════════════════════════════════════════
-- HWID SYSTEM (1 HWID Per Key)
-- ════════════════════════════════════════════════════════
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
        hwid = lp and tostring(lp.UserId) or "hwid_fallback_device"
    end

    return tostring(hwid):gsub("%s+", "")
end

local MY_HWID = getClientHWID()

-- ════════════════════════════════════════════════════════
-- SECURE DIRECT HTTP REQUEST
-- ════════════════════════════════════════════════════════
local raw_http_get = (clonefunction and clonefunction(game.HttpGet)) or game.HttpGet
local raw_request  = (clonefunction and (request and clonefunction(request) or (syn and syn.request and clonefunction(syn.request)) or (http and http.request and clonefunction(http.request)) or (http_request and clonefunction(http_request)))) or (request or (syn and syn.request) or (http and http.request) or http_request)

local function performHttpRequest(url, method, customHeaders, bodyData)
    method = method or "GET"
    local headers = customHeaders or {}
    local nowTime = tostring(os.time() * 1000)
    local nonce = tostring(math.random(1000000, 9999999)) .. "_" .. nowTime

    headers["X-HWID"] = MY_HWID
    headers["X-Timestamp"] = nowTime
    headers["X-Nonce"] = nonce
    headers["X-Client-Ver"] = "1.1"
    headers["X-Game-Id"] = tostring(game.PlaceId)
    headers["X-Game-Name"] = (getgenv and getgenv().CiganyHub_Game) or ""

    if raw_request then
        local ok, res = pcall(function()
            return raw_request({Url = url, Method = method, Headers = headers, Body = bodyData})
        end)
        if ok and res then
            return res.Body or res.body, res.StatusCode or res.status_code or 200
        end
    end

    if raw_http_get and method == "GET" then
        local success, resBody = pcall(function() return raw_http_get(game, url) end)
        return resBody, success and 200 or 400
    end

    return nil, 500
end

-- ════════════════════════════════════════════════════════
-- FILE SYSTEM (Key persistence)
-- ════════════════════════════════════════════════════════
local function fsSave(key)
    if writefile then
        local payload = HttpService:JSONEncode({
            key = key,
            hwid = MY_HWID,
            savedAt = os.time()
        })
        pcall(writefile, KEY_FILE, payload)
    end
end

local function fsLoad()
    if isfile and readfile and isfile(KEY_FILE) then
        local ok, content = pcall(readfile, KEY_FILE)
        if ok and content and #content > 5 then
            local okParse, parsed = pcall(function() return HttpService:JSONDecode(content) end)
            if okParse and parsed and parsed.key then
                return parsed.key
            else
                return content:gsub('["\r\n ]', '')
            end
        end
    end
    return nil
end

local function fsClear()
    if delfile and isfile and isfile(KEY_FILE) then
        pcall(delfile, KEY_FILE)
    end
end

-- ════════════════════════════════════════════════════════
-- UI CLEANUP
-- ════════════════════════════════════════════════════════
if CoreGui:FindFirstChild("CiganyKeySystem") then
    CoreGui.CiganyKeySystem:Destroy()
end
if Lighting:FindFirstChild("CiganyKeyBlur") then
    Lighting.CiganyKeyBlur:Destroy()
end

local GUI = Instance.new("ScreenGui")
GUI.Name           = "CiganyKeySystem"
GUI.ResetOnSpawn   = false
GUI.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
GUI.IgnoreGuiInset = true

if syn and syn.protect_gui then
    syn.protect_gui(GUI)
    GUI.Parent = CoreGui
elseif gethui then
    GUI.Parent = gethui()
else
    GUI.Parent = CoreGui
end

local blur = Instance.new("BlurEffect")
blur.Size = 16
blur.Name = "CiganyKeyBlur"
blur.Parent = Lighting

local function Tw(obj, t, g)
    TweenService:Create(obj, TweenInfo.new(t), g):Play()
end
local function TwE(obj, t, es, ed, g)
    TweenService:Create(obj, TweenInfo.new(t, es, ed), g):Play()
end
local function TwLoop(obj, t, es, g)
    TweenService:Create(obj, TweenInfo.new(t, es, Enum.EasingDirection.InOut, -1, true), g):Play()
end

local function MkFrame(parent, size, pos, bg, r, z)
    local f = Instance.new("Frame", parent)
    f.Size = size
    f.Position = pos
    f.BackgroundColor3 = bg or C.bg1
    f.BorderSizePixel = 0
    if r then Instance.new("UICorner", f).CornerRadius = UDim.new(0, r) end
    if z then f.ZIndex = z end
    return f
end

local function MkStroke(parent, col, thick, trans)
    local s = Instance.new("UIStroke", parent)
    s.Color = col or C.brd
    s.Thickness = thick or 1
    s.Transparency = trans or 0
    return s
end

local function MkLbl(parent, text, sz, col, font, xa)
    local l = Instance.new("TextLabel", parent)
    l.Size = UDim2.new(1,0,1,0)
    l.Position = UDim2.new(0,0,0,0)
    l.BackgroundTransparency = 1
    l.Text = text
    l.TextSize = sz or 13
    l.TextColor3 = col or C.txt
    l.Font = font or Enum.Font.GothamMedium
    l.TextXAlignment = xa or Enum.TextXAlignment.Left
    l.TextYAlignment = Enum.TextYAlignment.Center
    l.TextWrapped = false
    return l
end

local function MkBtn(parent, size, pos, bg, r, z)
    local b = Instance.new("TextButton", parent)
    b.Size = size
    b.Position = pos
    b.BackgroundColor3 = bg or C.bg3
    b.BorderSizePixel = 0
    b.Text = ""
    b.AutoButtonColor = false
    if r then Instance.new("UICorner", b).CornerRadius = UDim.new(0, r) end
    if z then b.ZIndex = z end
    return b
end

local function Hover(btn, norm, hot)
    btn.MouseEnter:Connect(function() Tw(btn, 0.14, {BackgroundColor3 = hot}) end)
    btn.MouseLeave:Connect(function() Tw(btn, 0.14, {BackgroundColor3 = norm}) end)
end

local function Press(btn, size, pos)
    btn.MouseButton1Down:Connect(function()
        Tw(btn, 0.07, {
            Size = UDim2.new(size.X.Scale, size.X.Offset-2, size.Y.Scale, size.Y.Offset-2),
            Position = UDim2.new(pos.X.Scale, pos.X.Offset+1, pos.Y.Scale, pos.Y.Offset+1),
        })
    end)
    btn.MouseButton1Up:Connect(function()
        Tw(btn, 0.07, {Size = size, Position = pos})
    end)
end

-- ════════════════════════════════════════════════════════
-- PANEL DIMENSIONS
-- ════════════════════════════════════════════════════════
local PW = isMobile and math.min(340, workspace.CurrentCamera.ViewportSize.X - 16) or 490
local PH = isMobile and 480 or 420

-- Backdrop
local Backdrop = MkFrame(GUI, UDim2.new(1,0,1,0), UDim2.new(0,0,0,0), C.black, 0, 1)
Backdrop.BackgroundTransparency = 1

-- Outer Glow
local GlowBg = MkFrame(GUI, UDim2.new(0,PW+80,0,PH+60), UDim2.new(0.5,0,0.5,0), C.acc, 40, 0)
GlowBg.AnchorPoint = Vector2.new(0.5,0.5)
GlowBg.BackgroundTransparency = 0.92
TweenService:Create(GlowBg,
    TweenInfo.new(4, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
    {BackgroundTransparency = 0.86, Size = UDim2.new(0,PW+110,0,PH+90)}):Play()

-- Main Panel
local Panel = MkFrame(GUI, UDim2.new(0,PW,0,PH), UDim2.new(0.5,0,0.5,0), C.bg1, 14, 2)
Panel.AnchorPoint = Vector2.new(0.5,0.5)
Panel.ClipsDescendants = true
Panel.Active = true
Panel.Draggable = true
MkStroke(Panel, C.brd2, 1)

-- Glass Sheen (Properly curved top corners)
local Sheen = MkFrame(Panel, UDim2.new(1,0,0.45,0), UDim2.new(0,0,0,0), C.white, 14, 3)
Sheen.BackgroundTransparency = 0.97
local sheenG = Instance.new("UIGradient", Sheen)
sheenG.Rotation = 90
sheenG.Transparency = NumberSequence.new{
    NumberSequenceKeypoint.new(0, 0.92),
    NumberSequenceKeypoint.new(1, 1),
}

-- ════════════════════════════════════════════════════════
-- TOP BAR (Properly trimmed top corners)
-- ════════════════════════════════════════════════════════
local TBH = isMobile and 44 or 38
local TopBar = MkFrame(Panel, UDim2.new(1,0,0,TBH), UDim2.new(0,0,0,0), C.bg0, 14, 4)
-- Square out only the bottom of the topbar so the top corners stay rounded:
local tbBottomPatch = MkFrame(TopBar, UDim2.new(1,0,0,12), UDim2.new(0,0,1,-12), C.bg0, 0, 4)
tbBottomPatch.BorderSizePixel = 0
local tbRedLine = MkFrame(TopBar, UDim2.new(1,0,0,2), UDim2.new(0,0,1,-2), C.acc, 0, 5)
tbRedLine.BorderSizePixel = 0

-- Brand text
local BrandLbl = MkLbl(TopBar,
    '<font color="#ff1e27">CIGANY</font>HUB',
    isMobile and 14 or 13, C.white, Enum.Font.GothamBold, Enum.TextXAlignment.Left)
BrandLbl.Size = UDim2.new(0, 120, 1, -4)
BrandLbl.Position = UDim2.new(0, 14, 0, 2)
BrandLbl.RichText = true
BrandLbl.ZIndex = 6

-- Badge
local BadgeF = MkFrame(TopBar, UDim2.new(0,84,0,isMobile and 18 or 16),
    UDim2.new(0, isMobile and 130 or 120, 0.5, isMobile and -9 or -8), C.bg3, 4, 6)
MkStroke(BadgeF, C.brd2, 1)
local bLbl = MkLbl(BadgeF, "Key System", 8, C.txt2, Enum.Font.GothamMedium, Enum.TextXAlignment.Center)
bLbl.ZIndex = 7

-- Close button
local cSz = isMobile and 30 or 26
local CloseBtn = MkBtn(TopBar, UDim2.new(0,cSz,0,cSz), UDim2.new(1,-(cSz+6),0.5,-cSz/2), C.bg2, 6, 6)
local cLbl = MkLbl(CloseBtn, "×", isMobile and 18 or 16, Color3.fromRGB(220,60,60), Enum.Font.GothamBold, Enum.TextXAlignment.Center)
cLbl.ZIndex = 7
Hover(CloseBtn, C.bg2, C.acc)
CloseBtn.MouseEnter:Connect(function() cLbl.TextColor3 = C.white end)
CloseBtn.MouseLeave:Connect(function() cLbl.TextColor3 = Color3.fromRGB(220,60,60) end)

-- ════════════════════════════════════════════════════════
-- CONTENT AREA
-- ════════════════════════════════════════════════════════
local PAD  = 18
local Cont = MkFrame(Panel,
    UDim2.new(1,-PAD*2,1,-(TBH+14)),
    UDim2.new(0,PAD,0,TBH+8),
    C.bg1, 0, 3)
Cont.BackgroundTransparency = 1

-- ════════════════════════════════════════════════════════
-- CENTER LOGO
-- ════════════════════════════════════════════════════════
local logoSz = isMobile and 62 or 68
local LogoWrap = MkFrame(Cont,
    UDim2.new(0,logoSz,0,logoSz),
    UDim2.new(0.5,-logoSz/2,0,2),
    C.bg2, 16, 4)
MkStroke(LogoWrap, C.acc, 2, 0.3)

local rStroke = LogoWrap:FindFirstChildOfClass("UIStroke")
local rGrad = Instance.new("UIGradient")
rGrad.Color = ColorSequence.new{
    ColorSequenceKeypoint.new(0, C.acc),
    ColorSequenceKeypoint.new(0.5, C.accGlow),
    ColorSequenceKeypoint.new(1, C.accDark),
}
rGrad.Parent = rStroke
TweenService:Create(rGrad,
    TweenInfo.new(3, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1),
    {Rotation = 360}):Play()

local logoLbl = Instance.new("TextLabel", LogoWrap)
logoLbl.Size = UDim2.new(1,0,1,0)
logoLbl.BackgroundTransparency = 1
logoLbl.Text = '<font color="#ff1e27">C</font>H'
logoLbl.RichText = true
logoLbl.TextColor3 = C.white
logoLbl.Font = Enum.Font.GothamBold
logoLbl.TextSize = isMobile and 22 or 24
logoLbl.TextXAlignment = Enum.TextXAlignment.Center
logoLbl.TextYAlignment = Enum.TextYAlignment.Center
logoLbl.ZIndex = 5

TwLoop(LogoWrap, 2.2, Enum.EasingStyle.Sine, {BackgroundColor3 = C.bg3})

-- ════════════════════════════════════════════════════════
-- TITLE + SUBTITLE
-- ════════════════════════════════════════════════════════
local titleY = logoSz + 10

local TitleLbl = MkLbl(Cont, "Verify Your Key",
    isMobile and 18 or 19, C.white, Enum.Font.GothamBold, Enum.TextXAlignment.Center)
TitleLbl.Size = UDim2.new(1,0,0,isMobile and 24 or 26)
TitleLbl.Position = UDim2.new(0,0,0,titleY)
TitleLbl.ZIndex = 4

local SubLbl = MkLbl(Cont, "Keys last 8 hours and are locked to 1 hardware device.",
    isMobile and 11 or 12, C.txt2, Enum.Font.Gotham, Enum.TextXAlignment.Center)
SubLbl.Size = UDim2.new(1,0,0,isMobile and 16 or 18)
SubLbl.Position = UDim2.new(0,0,0,titleY+(isMobile and 26 or 28))
SubLbl.ZIndex = 4

-- ════════════════════════════════════════════════════════
-- KEY INPUT
-- ════════════════════════════════════════════════════════
local inputY = titleY+(isMobile and 50 or 54)
local inputH = isMobile and 40 or 38

local InputWrap = MkFrame(Cont, UDim2.new(1,0,0,inputH), UDim2.new(0,0,0,inputY), C.bg2, 8, 4)
local inputStroke = MkStroke(InputWrap, C.brd2, 1, 0.25)

local keyTagW = isMobile and 38 or 34
local keyTagF = MkFrame(InputWrap, UDim2.new(0,keyTagW,1,-8), UDim2.new(0,6,0,4), C.bg3, 6, 5)
local ktLbl = MkLbl(keyTagF, "KEY", 8, C.acc, Enum.Font.GothamBold, Enum.TextXAlignment.Center)
ktLbl.ZIndex = 6
MkFrame(InputWrap, UDim2.new(0,1,1,-12), UDim2.new(0,keyTagW+10,0,6), C.brd2, 0, 5)

local KeyInput = Instance.new("TextBox", InputWrap)
KeyInput.Size = UDim2.new(1,-(keyTagW+18),1,0)
KeyInput.Position = UDim2.new(0,keyTagW+14,0,0)
KeyInput.BackgroundTransparency = 1
KeyInput.PlaceholderText = "Paste your 8-hour key here (KEY_...)"
KeyInput.PlaceholderColor3 = C.txt3
KeyInput.Text = ""
KeyInput.TextColor3 = C.txt
KeyInput.TextSize = isMobile and 11 or 12
KeyInput.Font = Enum.Font.GothamMedium
KeyInput.TextXAlignment = Enum.TextXAlignment.Left
KeyInput.ClearTextOnFocus = false
KeyInput.ZIndex = 5
Instance.new("UIPadding", KeyInput).PaddingLeft = UDim.new(0,2)

KeyInput.Focused:Connect(function()
    Tw(inputStroke, 0.16, {Color=C.acc, Thickness=1.5, Transparency=0})
    Tw(InputWrap, 0.16, {BackgroundColor3=C.bg3})
end)
KeyInput.FocusLost:Connect(function()
    Tw(inputStroke, 0.16, {Color=C.brd2, Thickness=1, Transparency=0.25})
    Tw(InputWrap, 0.16, {BackgroundColor3=C.bg2})
end)

-- ════════════════════════════════════════════════════════
-- STATUS TEXT
-- ════════════════════════════════════════════════════════
local statusY = inputY+inputH+4
local StatusLbl = MkLbl(Cont, "", isMobile and 10 or 11, C.txt2, Enum.Font.Gotham, Enum.TextXAlignment.Center)
StatusLbl.Size = UDim2.new(1,0,0,16)
StatusLbl.Position = UDim2.new(0,0,0,statusY)
StatusLbl.ZIndex = 4

local function SetStatus(msg, col, dur)
    StatusLbl.Text = msg
    StatusLbl.TextColor3 = col or C.txt2
    if dur and dur > 0 then
        task.delay(dur, function()
            if StatusLbl.Text == msg then StatusLbl.Text = "" end
        end)
    end
end

local function ShakeInput()
    local orig = InputWrap.Position
    for _ = 1, 3 do
        Tw(InputWrap, 0.05, {Position=UDim2.new(orig.X.Scale,orig.X.Offset-7,orig.Y.Scale,orig.Y.Offset)})
        task.wait(0.05)
        Tw(InputWrap, 0.05, {Position=UDim2.new(orig.X.Scale,orig.X.Offset+7,orig.Y.Scale,orig.Y.Offset)})
        task.wait(0.05)
    end
    InputWrap.Position = orig
end

-- ════════════════════════════════════════════════════════
-- BUTTONS (Get Key | Verify Key)
-- ════════════════════════════════════════════════════════
local btnY   = inputY+inputH+(isMobile and 24 or 22)
local btnH   = isMobile and 38 or 36
local btnGap = 8

-- Get Key Button
local GKSz  = UDim2.new(0.5,-btnGap/2,0,btnH)
local GKPos = UDim2.new(0,0,0,btnY)
local GKBtn = MkBtn(Cont, GKSz, GKPos, C.bg3, 8, 4)
MkStroke(GKBtn, C.brd2, 1, 0.3)
local gkGrad = Instance.new("UIGradient", GKBtn)
gkGrad.Rotation = 90
gkGrad.Color = ColorSequence.new{
    ColorSequenceKeypoint.new(0, C.bg4),
    ColorSequenceKeypoint.new(1, C.bg3),
}
local gkLbl = MkLbl(GKBtn, "Get Key", isMobile and 12 or 13, C.txt, Enum.Font.GothamSemibold, Enum.TextXAlignment.Center)
gkLbl.ZIndex = 5
Hover(GKBtn, C.bg3, C.bg4)
GKBtn.MouseEnter:Connect(function() gkLbl.TextColor3 = C.white end)
GKBtn.MouseLeave:Connect(function() gkLbl.TextColor3 = C.txt end)
Press(GKBtn, GKSz, GKPos)

-- Verify Key Button
local VKSz  = UDim2.new(0.5,-btnGap/2,0,btnH)
local VKPos = UDim2.new(0.5,btnGap/2,0,btnY)
local VKBtn = MkBtn(Cont, VKSz, VKPos, C.acc, 8, 4)
local vkGrad = Instance.new("UIGradient", VKBtn)
vkGrad.Rotation = 90
vkGrad.Color = ColorSequence.new{
    ColorSequenceKeypoint.new(0, C.accGlow),
    ColorSequenceKeypoint.new(1, C.accDark),
}
local vkLbl = MkLbl(VKBtn, "Verify Key", isMobile and 12 or 13, C.white, Enum.Font.GothamBold, Enum.TextXAlignment.Center)
vkLbl.ZIndex = 5
Hover(VKBtn, C.acc, C.accGlow)
Press(VKBtn, VKSz, VKPos)

-- ════════════════════════════════════════════════════════
-- DIVIDER
-- ════════════════════════════════════════════════════════
local divY = btnY+btnH+(isMobile and 14 or 12)
MkFrame(Cont, UDim2.new(1,0,0,1), UDim2.new(0,0,0,divY), C.brd, 0, 3)

-- ════════════════════════════════════════════════════════
-- BOTTOM ROW (Discord | cganyhub.vercel.app)
-- ════════════════════════════════════════════════════════
local botY    = divY+(isMobile and 12 or 10)
local botRowH = isMobile and 30 or 28
local dcBtnW  = isMobile and 110 or 100

local DcBtn = MkBtn(Cont, UDim2.new(0,dcBtnW,0,botRowH), UDim2.new(0,0,0,botY), C.bg3, 6, 4)
MkStroke(DcBtn, C.brd2, 1, 0.35)
local dcGrad = Instance.new("UIGradient", DcBtn)
dcGrad.Rotation = 90
dcGrad.Color = ColorSequence.new{
    ColorSequenceKeypoint.new(0, Color3.fromRGB(26,29,40)),
    ColorSequenceKeypoint.new(1, C.bg3),
}
local dcLbl = MkLbl(DcBtn, "Discord", isMobile and 12 or 12, C.dcBlue, Enum.Font.GothamSemibold, Enum.TextXAlignment.Center)
dcLbl.ZIndex = 5
Hover(DcBtn, C.bg3, C.bg4)
DcBtn.MouseEnter:Connect(function() dcLbl.TextColor3 = Color3.fromRGB(155,175,255) end)
DcBtn.MouseLeave:Connect(function() dcLbl.TextColor3 = C.dcBlue end)

DcBtn.MouseButton1Click:Connect(function()
    if setclipboard then
        setclipboard(DISCORD_INVITE)
        SetStatus("Discord link copied to clipboard.", C.txt, 4)
        dcLbl.Text = "Copied!"
        task.delay(2, function() dcLbl.Text = "Discord" end)
    else
        SetStatus("Join: " .. DISCORD_INVITE, C.txt, 5)
    end
end)

local SiteLbl = MkLbl(Cont, "cganyhub.vercel.app", isMobile and 10 or 10, C.txt3, Enum.Font.Gotham, Enum.TextXAlignment.Right)
SiteLbl.Size = UDim2.new(1,-(dcBtnW+10),0,botRowH)
SiteLbl.Position = UDim2.new(0,dcBtnW+8,0,botY)
SiteLbl.ZIndex = 4

-- ════════════════════════════════════════════════════════
-- FLOATING PARTICLES
-- ════════════════════════════════════════════════════════
task.spawn(function()
    while Panel and Panel.Parent do
        local p = MkFrame(Panel,
            UDim2.new(0,math.random(2,4),0,math.random(2,4)),
            UDim2.new(math.random(),0,1,0),
            C.acc, 2, 6)
        p.BackgroundTransparency = 0.65
        TweenService:Create(p,
            TweenInfo.new(math.random(9,14), Enum.EasingStyle.Linear),
            {Position=UDim2.new(p.Position.X.Scale,0,-0.08,0), BackgroundTransparency=1}):Play()
        task.delay(15, function() if p and p.Parent then p:Destroy() end end)
        task.wait(math.random(2,4))
    end
end)

-- ════════════════════════════════════════════════════════
-- LOADING OVERLAY
-- ════════════════════════════════════════════════════════
local LoadOv = MkFrame(Panel, UDim2.new(1,0,1,0), UDim2.new(0,0,0,0), C.bg1, 14, 20)
LoadOv.Visible = false

local SpinH = MkFrame(LoadOv, UDim2.new(0,60,0,60), UDim2.new(0.5,-30,0.5,-50), C.bg1, 0, 21)
SpinH.BackgroundTransparency = 1

local TrCirc = MkFrame(SpinH, UDim2.new(1,0,1,0), UDim2.new(0,0,0,0), C.bg1, 0, 21)
TrCirc.BackgroundTransparency = 1
MkStroke(TrCirc, C.brd2, 4, 0.6)
Instance.new("UICorner", TrCirc).CornerRadius = UDim.new(1,0)

local ArcCirc = MkFrame(SpinH, UDim2.new(1,0,1,0), UDim2.new(0,0,0,0), C.bg1, 0, 22)
ArcCirc.BackgroundTransparency = 1
local arcS = MkStroke(ArcCirc, C.acc, 4, 0)
Instance.new("UICorner", ArcCirc).CornerRadius = UDim.new(1,0)
local arcG = Instance.new("UIGradient", arcS)
arcG.Transparency = NumberSequence.new{
    NumberSequenceKeypoint.new(0,0),
    NumberSequenceKeypoint.new(0.45,0.1),
    NumberSequenceKeypoint.new(0.75,0.6),
    NumberSequenceKeypoint.new(1,1),
}
TweenService:Create(SpinH,
    TweenInfo.new(1, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1),
    {Rotation=360}):Play()

local LoadTxt = MkLbl(LoadOv, "Checking verification", isMobile and 14 or 15, C.txt, Enum.Font.GothamBold, Enum.TextXAlignment.Center)
LoadTxt.Size = UDim2.new(1,0,0,22)
LoadTxt.Position = UDim2.new(0,0,0.5,20)
LoadTxt.ZIndex = 22

local LoadSub = MkLbl(LoadOv, "Validating 8-hour session & HWID...", isMobile and 10 or 11, C.txt2, Enum.Font.Gotham, Enum.TextXAlignment.Center)
LoadSub.Size = UDim2.new(1,0,0,16)
LoadSub.Position = UDim2.new(0,0,0.5,44)
LoadSub.ZIndex = 22

local function ShowLoading(show, msg)
    if msg then LoadTxt.Text = msg end
    LoadOv.Visible = show
end

-- ════════════════════════════════════════════════════════
-- SUCCESS OVERLAY
-- ════════════════════════════════════════════════════════
local function ShowSuccess(msg)
    local Ov = MkFrame(Panel, UDim2.new(1,0,1,0), UDim2.new(0,0,0,0), C.bg1, 14, 30)
    Ov.BackgroundTransparency = 1
    Tw(Ov, 0.22, {BackgroundTransparency=0.05})

    local cSz2 = 76
    local Circ = MkFrame(Ov,
        UDim2.new(0,cSz2,0,cSz2),
        UDim2.new(0.5,-cSz2/2,0.5,-60),
        C.grn, cSz2/2, 31)
    Circ.BackgroundTransparency = 0.15
    TwE(Circ, 0.4, Enum.EasingStyle.Back, Enum.EasingDirection.Out,
        {Size=UDim2.new(0,84,0,84), Position=UDim2.new(0.5,-42,0.5,-64)})

    local ckL = MkLbl(Circ, "✓", 38, C.white, Enum.Font.GothamBold, Enum.TextXAlignment.Center)
    ckL.ZIndex = 32

    local sT = MkLbl(Ov, msg or "Key Verified!", isMobile and 17 or 18, C.grn, Enum.Font.GothamBold, Enum.TextXAlignment.Center)
    sT.Size = UDim2.new(1,0,0,24)
    sT.Position = UDim2.new(0,0,0.5,30)
    sT.ZIndex = 31

    local sS = MkLbl(Ov, "Starting CiganyHub...", isMobile and 11 or 12, C.txt2, Enum.Font.Gotham, Enum.TextXAlignment.Center)
    sS.Size = UDim2.new(1,0,0,16)
    sS.Position = UDim2.new(0,0,0.5,56)
    sS.ZIndex = 31

    task.wait(1.1)
end

-- ════════════════════════════════════════════════════════
-- ENTRANCE ANIMATION
-- ════════════════════════════════════════════════════════
Panel.BackgroundTransparency = 1
Panel.Position = UDim2.new(0.5,0,0.5,36)
TwE(Panel, 0.32, Enum.EasingStyle.Back, Enum.EasingDirection.Out,
    {BackgroundTransparency=0, Position=UDim2.new(0.5,0,0.5,0)})
Tw(Backdrop, 0.22, {BackgroundTransparency=0.35})

-- ════════════════════════════════════════════════════════
-- CLOSE FUNCTION
-- ════════════════════════════════════════════════════════
local function CloseUI()
    local b = Lighting:FindFirstChild("CiganyKeyBlur")
    Tw(Panel, 0.18, {BackgroundTransparency=1, Position=UDim2.new(0.5,0,0.5,28)})
    Tw(Backdrop, 0.18, {BackgroundTransparency=1})
    task.wait(0.20)
    if b then b:Destroy() end
    if GUI and GUI.Parent then GUI:Destroy() end
end

CloseBtn.MouseButton1Click:Connect(CloseUI)

-- ════════════════════════════════════════════════════════
-- GET KEY BUTTON (Copies Gateway URL)
-- ════════════════════════════════════════════════════════
GKBtn.MouseButton1Click:Connect(function()
    if setclipboard then
        setclipboard(VERCEL_DOMAIN)
        SetStatus("Link copied! Complete LootLabs in browser.", C.grn, 5)
        gkLbl.Text = "Copied!"
        task.delay(2.5, function() gkLbl.Text = "Get Key" end)
    else
        SetStatus("Visit: " .. VERCEL_DOMAIN, C.txt, 6)
    end
end)

-- ════════════════════════════════════════════════════════
-- RUN SCRIPT EXECUTION
-- ════════════════════════════════════════════════════════
local function executePayload(scriptCode)
    CloseUI()
    local func, err = loadstring(scriptCode)
    if func then
        func()
    else
        warn("[CiganyHub Execution Error] " .. tostring(err))
    end
end

-- ════════════════════════════════════════════════════════
-- VERIFY KEY FUNCTION
-- ════════════════════════════════════════════════════════
local verifying = false

local function DoVerify(rawKey, isAutoCheck)
    if verifying then return end
    local key = (rawKey or ""):gsub("%s+","")
    if key == "" then
        if not isAutoCheck then
            SetStatus("Please enter your key first.", C.acc, 3)
            task.spawn(ShakeInput)
        end
        return
    end

    verifying = true
    if not isAutoCheck then
        vkLbl.Text = "Checking..."
        VKBtn.Active = false
    end

    task.spawn(function()
        local url = VERCEL_DOMAIN .. "/api/get-script"
        local postBody = HttpService:JSONEncode({
            key = key,
            hwid = MY_HWID,
            placeId = tostring(game.PlaceId),
            game = (getgenv and getgenv().CiganyHub_Game) or ""
        })
        local headers = {
            ["Content-Type"] = "application/json",
            ["X-Hub-Key"] = key,
            ["X-HWID"] = MY_HWID,
            ["X-Game-Id"] = tostring(game.PlaceId),
            ["X-Game-Name"] = (getgenv and getgenv().CiganyHub_Game) or ""
        }
        local body, status = performHttpRequest(url, "POST", headers, postBody)

        -- Fallback to GET with query params if executor does not support POST requests
        if status ~= 200 or not body or string.find(body, "500") then
            local fallbackUrl = VERCEL_DOMAIN .. "/api/get-script?key=" .. HttpService:UrlEncode(key) .. "&hwid=" .. HttpService:UrlEncode(MY_HWID) .. "&placeId=" .. tostring(game.PlaceId) .. "&game=" .. HttpService:UrlEncode((getgenv and getgenv().CiganyHub_Game) or "")
            body, status = performHttpRequest(fallbackUrl, "GET", headers, nil)
        end

        if status == 200 and body and not string.find(body, "403 Forbidden") and not string.find(body, "401 Unauthorized") then
            fsSave(key)
            ShowLoading(false)
            ShowSuccess(isAutoCheck and "Saved Key Verified!" or "Key Verified & Bound!")
            verifying = false
            executePayload(body)
        else
            ShowLoading(false)
            if string.find(body or "", "different Hardware ID") then
                SetStatus("Key locked to a different Hardware ID (HWID).", C.acc, 5)
            elseif string.find(body or "", "expired") then
                SetStatus("Key has expired. Please get a new key.", C.acc, 5)
                if isAutoCheck then fsClear() end
            else
                SetStatus("Invalid key. Complete LootLabs tasks.", C.acc, 5)
                if isAutoCheck then fsClear() end
            end

            if not isAutoCheck then
                task.spawn(ShakeInput)
                Tw(InputWrap, 0.09, {BackgroundColor3=Color3.fromRGB(50,16,16)})
                task.delay(0.38, function()
                    Tw(InputWrap, 0.18, {BackgroundColor3=C.bg2})
                end)
                Tw(inputStroke, 0.12, {Color=C.acc, Thickness=1.5, Transparency=0})
                task.delay(1.2, function()
                    Tw(inputStroke, 0.18, {Color=C.brd2, Thickness=1, Transparency=0.25})
                end)
            end

            vkLbl.Text = "Verify Key"
            VKBtn.Active = true
            verifying = false
        end
    end)
end

VKBtn.MouseButton1Click:Connect(function() DoVerify(KeyInput.Text, false) end)
KeyInput.FocusLost:Connect(function(enter)
    if enter then DoVerify(KeyInput.Text, false) end
end)

-- ════════════════════════════════════════════════════════
-- AUTO-CHECK SAVED KEY ON STARTUP
-- ════════════════════════════════════════════════════════
task.spawn(function()
    local savedKey = fsLoad()
    if savedKey and #savedKey > 5 then
        KeyInput.Text = savedKey
        ShowLoading(true, "Checking saved session")
        DoVerify(savedKey, true)
    end
end)
