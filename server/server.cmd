CALL npm i || PAUSE

PUSHD ..\web
CALL client.cmd || PAUSE
POPD

CALL npm run dev || PAUSE