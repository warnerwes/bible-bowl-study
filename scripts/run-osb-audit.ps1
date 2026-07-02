param(
  [int]$SleepMs = 0,
  [string]$Only,
  [string]$Model = "meta/llama-3.3-70b-instruct",
  [switch]$Force,
  [switch]$NoResume,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ExtraArgs
)

$args = @("scripts/osb-audit.mjs", "--sleep", $SleepMs, "--model", $Model)

if ($Only) {
  $args += @("--only", $Only)
}
if ($Force) {
  $args += "--force"
}
if ($NoResume) {
  $args += "--no-resume"
}
if ($ExtraArgs) {
  $args += $ExtraArgs
}

node @args
