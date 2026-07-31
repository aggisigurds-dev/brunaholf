@echo off
setlocal
REM ===================================================================
REM  Brunaholf local MCP - skyja-tengill fyrir Claude Code a THESSARI vel
REM ===================================================================
REM  Hvad thetta gerir: skrair "brunaholf-local" MCP-thjoninn hja Claude
REM  Code svo staðbundinn Claude a thessari vel geti:
REM    - lesid skrar i Downloads / Drive / Documents
REM    - hit-ad brunaholf.netlify.app (sem skyja-Claude naer ekki i beint)
REM    - opnad URL i vafranum
REM    - hladid skra upp i Google Drive (gegnum brunaholf OAuth)
REM
REM  Keyrsla: tvismelltu a skrana. Ekkert PowerShell.
REM
REM  Uppfaera / taka ut aftur:
REM    claude mcp remove brunaholf-local -s user
REM ===================================================================

cd /d "%~dp0"
echo.
echo  === Brunaholf local MCP - uppsetning ===
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  [X] Node.js finnst ekki. Settu hann upp fyrst: https://nodejs.org
  echo.
  pause
  exit /b 1
)
where claude >nul 2>&1
if errorlevel 1 (
  echo  [X] Claude Code CLI finnst ekki i PATH.
  echo      Settu hann upp fyrst:  npm i -g @anthropic-ai/claude-code
  echo.
  pause
  exit /b 1
)

echo  [1/4] Set upp pakkana (npm install)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo  [X] npm install fell. Er nettenging i lagi?
  pause
  exit /b 1
)

echo.
echo  [2/4] Profa thjoninn (node test.mjs)...
call node test.mjs
if errorlevel 1 (
  echo  [!] Sjalfsprof fell - held afram samt, en athugadu villuna her ad ofan.
)

echo.
echo  [3/4] Skrai "brunaholf-local" hja Claude Code (user scope)...
REM  -s user: adgengilegt i ollum mopum a thessari vel, ekki bara herna.
REM  Alger sloð ("%~dp0server.mjs") svo hann virki ur hvada mopu sem er.
call claude mcp add brunaholf-local -s user -- node "%~dp0server.mjs"
if errorlevel 1 (
  echo.
  echo  [X] Skraning fell. Reyndu handvirkt:
  echo      claude mcp add brunaholf-local -s user -- node "%~dp0server.mjs"
  pause
  exit /b 1
)

echo.
echo  [4/4] Stadfesti...
call claude mcp list

echo.
echo  === Buid ===
echo.
echo  Opnadu Claude Code (nyja lotu) og prufadu:
echo      "Listadu hvad er i Downloads"
echo      "Hit-adu https://brunaholf.netlify.app/api/data-sources-status"
echo.
echo  UPPHAL i Google Drive (valfrjalst): upload_to_drive_via_brunaholf
echo  tholir tokenlaus koll EKKI - settu sama leynilykil og a Netlify:
echo      setx LOCAL_UPLOAD_TOKEN "<sami og LOCAL_UPLOAD_TOKEN a brunaholf>"
echo  (loka svo Claude Code og opna aftur svo hann erfi breytuna).
echo  Les- og fetch-tolin virka an token.
echo.
pause
