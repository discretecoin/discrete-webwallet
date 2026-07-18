param(
    [string]$DiscreteSource = "D:\dev\discrete"
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$crypto = (Resolve-Path (Join-Path $DiscreteSource "src\crypto")).Path
$wrapper = (Resolve-Path (Join-Path $repo "src\wasm\yespower-wrapper.c")).Path
$output = Join-Path $repo "src\workers\yespower-module.js"

function To-WslPath([string]$path) {
    $resolved = [System.IO.Path]::GetFullPath($path)
    $drive = $resolved.Substring(0, 1).ToLowerInvariant()
    return "/mnt/$drive/" + $resolved.Substring(3).Replace("\", "/")
}

$arguments = @(
    (To-WslPath $wrapper),
    (To-WslPath (Join-Path $crypto "yespower.c")),
    (To-WslPath (Join-Path $crypto "blake256.c")),
    "-I" + (To-WslPath $crypto),
    "-O3",
    "-msimd128",
    "-sMODULARIZE=1",
    "-sEXPORT_NAME=createYespowerModule",
    "-sENVIRONMENT=worker,node",
    "-sSINGLE_FILE=1",
    "-sALLOW_MEMORY_GROWTH=1",
    "-sINITIAL_MEMORY=33554432",
    "-sWASM_BIGINT=1",
    "-sEXPORTED_FUNCTIONS=['_malloc','_free','_free_reg_hash','_grind_free_reg_pow']",
    "-o", (To-WslPath $output)
)

& wsl.exe emcc @arguments
if ($LASTEXITCODE -ne 0) { throw "emcc failed with exit code $LASTEXITCODE" }
