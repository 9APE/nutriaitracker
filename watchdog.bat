@echo off
cd /d C:\Users\ariim\nouri-eat-well

:loop

echo Starting Claude run...

notify.bat "Claude started 🚀"

claude --dangerously-accept-all "Run autonomous audit. Only execute if git changes exist."

echo Claude stopped or crashed. Restarting in 10 seconds...

notify.bat "Claude stopped or restarted ⚠️"

timeout /t 10

goto loop