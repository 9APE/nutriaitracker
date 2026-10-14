param([string]$msg)

$body = @{
    content = $msg
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://discord.com/api/webhooks/1501467199938887770/W4WpdjlBo0VJin8tkarzxqVPVimuSewTgCtYvmVNXlvvPZrA9Atk83SGpdxkwPRsXqDZ" `
  -Method Post `
  -Body $body `
  -ContentType "application/json"