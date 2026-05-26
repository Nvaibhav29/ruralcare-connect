$renderHost = "ruralcare-connect.onrender.com"
$renderBase = "https://" + $renderHost

$body = @{
  packageId = "com.ruralcare.connect"
  name = "RuralCare Connect"
  launcherName = "RuralCare"
  display = "standalone"
  orientation = "portrait"
  themeColor = "#0f766e"
  navigationColor = "#0f766e"
  backgroundColor = "#0d4f47"
  enableNotifications = $false
  startUrl = "/patient"
  iconUrl = $renderBase + "/icons/icon-512.png"
  maskableIconUrl = $renderBase + "/icons/icon-512.png"
  monochromeIconUrl = $renderBase + "/icons/icon-512.png"
  splashScreenFadeOutDuration = 300
  signingMode = "new"
  signing = @{
    alias = "ruralcare"
    fullName = "RuralCare Connect"
    organization = "RuralCare"
    organizationalUnit = "App"
    countryCode = "IN"
    keyPassword = "ruralcare2025"
    storePassword = "ruralcare2025"
  }
  generateAssetStatements = $true
  host = $renderHost
  manifestUrl = $renderBase + "/manifest.json"
  webManifestUrl = $renderBase + "/manifest.json"
  shortcuts = @()
  isChromeOSOnly = $false
  isMetaQuest = $false
  minSdkVersion = 21
  appVersion = "1.1"
  appVersionCode = 2
  fallbackType = "customtabs"
  features = @{ locationDelegation = @{ enabled = $false }; playBilling = @{ enabled = $false } }
  enableSiteSettingsShortcut = $true
  fullScopeUrl = $renderBase + "/"
  shareTarget = $null
  webManifest = @{
    name = "RuralCare Connect"
    short_name = "RuralCare"
    start_url = "/patient"
    display = "standalone"
    orientation = "portrait"
    theme_color = "#0f766e"
    background_color = "#0d4f47"
    icons = @(
      @{ src = $renderBase + "/icons/icon-512.png"; sizes = "512x512"; type = "image/png"; purpose = "any maskable" }
    )
  }
} | ConvertTo-Json -Depth 10

$outPath = "C:\ALL PROJECT\project\ruralcare-signed.apk.zip"

Write-Host "RuralCare Connect - APK Generator"
Write-Host "Target: $renderBase"
Write-Host "Calling PWABuilder API..."
Write-Host "This may take 1-2 minutes..."

try {
  Invoke-WebRequest `
    -Uri "https://pwabuilder-cloudapk.azurewebsites.net/generateApkZip" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 180 `
    -OutFile $outPath

  $sizeMB = [math]::Round((Get-Item $outPath).Length / 1MB, 2)
  Write-Host "SUCCESS! Signed APK downloaded to $outPath"
  Write-Host "File size: $sizeMB MB"
} catch {
  Write-Host "API call failed"
  Write-Host $_.Exception.Message
}
