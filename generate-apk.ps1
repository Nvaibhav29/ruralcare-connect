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
  iconUrl = "https://ruralcare-connect-production.up.railway.app/icons/icon-512.png"
  maskableIconUrl = "https://ruralcare-connect-production.up.railway.app/icons/icon-512.png"
  monochromeIconUrl = "https://ruralcare-connect-production.up.railway.app/icons/icon-512.png"
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
  host = "ruralcare-connect-production.up.railway.app"
  manifestUrl = "https://ruralcare-connect-production.up.railway.app/manifest.json"
  webManifestUrl = "https://ruralcare-connect-production.up.railway.app/manifest.json"
  shortcuts = @()
  isChromeOSOnly = $false
  isMetaQuest = $false
  minSdkVersion = 21
  appVersion = "1.0"
  appVersionCode = 1
  fallbackType = "customtabs"
  features = @{ locationDelegation = @{ enabled = $false }; playBilling = @{ enabled = $false } }
  enableSiteSettingsShortcut = $true
  fullScopeUrl = "https://ruralcare-connect-production.up.railway.app/"
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
      @{ src = "https://ruralcare-connect-production.up.railway.app/icons/icon-512.png"; sizes = "512x512"; type = "image/png"; purpose = "any maskable" }
    )
  }
} | ConvertTo-Json

Write-Host "Calling PWABuilder API to generate APK..."
Write-Host "This may take 1-2 minutes..."

try {
  $response = Invoke-WebRequest `
    -Uri "https://pwabuilder-cloudapk.azurewebsites.net/generateApkZip" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 180 `
    -OutFile "c:\project\ruralcare-signed.apk.zip"
  
  Write-Host "SUCCESS! Signed APK downloaded to c:\project\ruralcare-signed.apk.zip"
  Write-Host "File size: $((Get-Item 'c:\project\ruralcare-signed.apk.zip').Length / 1MB) MB"
} catch {
  Write-Host "API call failed: $_"
  Write-Host "Status: $($_.Exception.Response.StatusCode)"
}
