# Builds an APK without needing Windows Developer Mode.
#
#   ./scripts/android-build.ps1 -Arch aarch64 -Profile release   # for phones
#   ./scripts/android-build.ps1 -Arch x86_64  -Profile debug     # for the emulator
#
# `tauri android build` symlinks the compiled library into jniLibs, which on
# Windows requires Developer Mode. This does the same steps with a copy, then
# runs Gradle skipping that one task. See docs/ANDROID.md. Needs about 6 GB free.
param(
  [ValidateSet('aarch64', 'x86_64')] [string]$Arch = 'aarch64',
  [ValidateSet('debug', 'release')] [string]$Profile = 'release'
)

$freeGb = (Get-PSDrive (Get-Location).Drive.Name).Free / 1GB
if ($freeGb -lt 6) { throw "Only $([math]::Round($freeGb, 1)) GB free. The build needs about 6 GB; filling the disk can disrupt other running apps." }

if (-not $env:JAVA_HOME) { $env:JAVA_HOME = Split-Path (Split-Path (Get-Command java).Source) }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not $env:NDK_HOME) { $env:NDK_HOME = (Get-ChildItem "$env:ANDROID_HOME\ndk" | Sort-Object Name | Select-Object -Last 1).FullName }
$env:CARGO_INCREMENTAL = '0'
$env:CARGO_PROFILE_DEV_DEBUG = '0'
$env:CARGO_PROFILE_RELEASE_DEBUG = '0'

$rustTarget = "$Arch-linux-android"
$underscored = $rustTarget -replace '-', '_'
$abi = @{ x86_64 = 'x86_64'; aarch64 = 'arm64-v8a' }[$Arch]
$flavor = @{ x86_64 = 'X86_64'; aarch64 = 'Arm64' }[$Arch]
$gradleProfile = (Get-Culture).TextInfo.ToTitleCase($Profile)
$android = 'src-tauri\gen\android'

rustup target add $rustTarget
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }

$ndkBin = "$env:NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin"
$clang = "$ndkBin\$Arch-linux-android24-clang"
Set-Item "env:CC_$underscored" "$clang.cmd"
Set-Item "env:CXX_$underscored" "$clang++.cmd"
Set-Item "env:AR_$underscored" "$ndkBin\llvm-ar.exe"
Set-Item "env:CARGO_TARGET_$($underscored.ToUpper())_LINKER" "$clang.cmd"
$env:WRY_ANDROID_PACKAGE = 'com.archivomuerto.app'
$env:WRY_ANDROID_LIBRARY = 'app_lib'
$env:WRY_ANDROID_KOTLIN_FILES_OUT_DIR = "$PWD\$android\app\src\main\java\com\archivomuerto\app\generated"
$env:TAURI_ANDROID_PROJECT_PATH = "$PWD\$android"

$cargoArgs = @('build', '--target', $rustTarget, '--lib', '--manifest-path', 'src-tauri/Cargo.toml')
if ($Profile -eq 'release') { $cargoArgs += '--release' }
& cargo @cargoArgs
if ($LASTEXITCODE -ne 0) { throw 'Rust build failed' }

$jniLibs = "$android\app\src\main\jniLibs\$abi"
New-Item -ItemType Directory -Force $jniLibs | Out-Null
Copy-Item "src-tauri\target\$rustTarget\$Profile\libapp_lib.so" "$jniLibs\libapp_lib.so" -Force

Push-Location $android
try {
  & .\gradlew.bat --no-daemon "assemble$flavor$gradleProfile" -x "rustBuild$flavor$gradleProfile"
  if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }
} finally {
  Pop-Location
}

Get-ChildItem "$android\app\build\outputs\apk" -Recurse -Filter *.apk | Select-Object FullName, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }
