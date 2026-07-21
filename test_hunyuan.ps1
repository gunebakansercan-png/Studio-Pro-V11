# fn_index=2 ile kuyruğa gir ve SSE'den dönen mesajları gözlemle
$sessionHash = "diagtest$(Get-Random)"
$body = "{`"session_hash`":`"$sessionHash`",`"fn_index`":2,`"event_data`":null,`"trigger_id`":null,`"data`":[null,null,null,null,null,null,5,5.0,1234,256,true,8000,false]}"

$r = Invoke-WebRequest -Uri "https://tencent-hunyuan3d-2.hf.space/queue/join" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
Write-Output "Join Response: $($r.Content)"

# SSE'den 5 mesaj oku
Write-Output "`nSSE Messages (first 10 seconds):"
$sseUrl = "https://tencent-hunyuan3d-2.hf.space/queue/data?session_hash=$sessionHash"

$req = [System.Net.WebRequest]::Create($sseUrl)
$req.Method = "GET"
$req.Accept = "text/event-stream"
$resp = $req.GetResponse()
$stream = $resp.GetResponseStream()
$reader = New-Object System.IO.StreamReader($stream)

$count = 0
$startTime = Get-Date
while ($count -lt 5 -and ((Get-Date) - $startTime).TotalSeconds -lt 15) {
    $line = $reader.ReadLine()
    if ($line -ne $null -and $line.StartsWith("data:")) {
        Write-Output "MSG: $line"
        $count++
    }
}
$reader.Close()
