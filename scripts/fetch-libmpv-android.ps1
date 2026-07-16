# Fetch the Android libmpv prebuilt into the Android project's jniLibs.
#
# jniLibs/**/*.so is gitignored (tauri's generated .gitignore), so a fresh
# checkout has no player libraries; run this once before building the APK.
#
# Source: jarnedemeulemeester/libmpv-android (Findroid's build) v1.0.0 -
# mpv 0.41.0 / ffmpeg 8.1 / libplacebo 7.360.1 / libass, built with libplacebo's
# `dovi` feature default-ON, which is all mpv needs to apply Dolby Vision RPUs
# (libdovi is a separate parser libplacebo/mpv never call; the RPU comes from
# ffmpeg's software HEVC decoder). libmpv.so statically contains libplacebo +
# libass and links the shared ffmpeg .so set beside it. libplayer.so (their own
# JNI wrapper) is intentionally NOT taken - Rillio's Rust client replaces it.
# Binaries are effectively GPL (ffmpeg --enable-gpl), same posture as the
# Windows libmpv-2.dll we ship.
#
# DV per-title note (decision record, docs/cross-platform-refactor.md): DV RPUs
# do NOT survive mediacodec hwdec, so DV titles need hwdec=no (software decode);
# SDR/HDR10 can use hwdec=mediacodec.

$ErrorActionPreference = "Stop"

$version = "v1.0.0"
$url = "https://github.com/jarnedemeulemeester/libmpv-android/releases/download/$version/libmpv-release.aar"
# arm64 for devices; x86_64 kept available for emulator-native experiments.
$abis = @("arm64-v8a")
$libs = @(
    "libmpv.so", "libavcodec.so", "libavdevice.so", "libavfilter.so",
    "libavformat.so", "libavutil.so", "libswresample.so", "libswscale.so",
    "libc++_shared.so"
)

$repoRoot = Split-Path $PSScriptRoot -Parent
$jniLibs = Join-Path $repoRoot "apps\desktop\src-tauri\gen\android\app\src\main\jniLibs"
$tmp = Join-Path $env:TEMP "libmpv-android-$version"

Write-Host "downloading $url"
New-Item -ItemType Directory -Force $tmp | Out-Null
$zip = Join-Path $tmp "libmpv-release.zip"
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath (Join-Path $tmp "aar") -Force

foreach ($abi in $abis) {
    $dst = Join-Path $jniLibs $abi
    New-Item -ItemType Directory -Force $dst | Out-Null
    foreach ($lib in $libs) {
        Copy-Item (Join-Path $tmp "aar\jni\$abi\$lib") $dst -Force
        Write-Host "  $abi/$lib"
    }
}
Write-Host "done: libmpv $version staged into jniLibs"
