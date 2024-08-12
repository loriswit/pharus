@echo off

set ROOT_DIR=%~dp0..

:: build image if needed
docker image inspect pharus_cli >nul 2>&1 ^
    || docker build -t pharus_cli %ROOT_DIR%

docker run --rm -it ^
    -v %ROOT_DIR%\apps:/pharus/apps ^
    -v %ROOT_DIR%\reports:/pharus/reports ^
    -v /var/run/docker.sock:/var/run/docker.sock ^
    -e HOST_PATH=%ROOT_DIR% ^
    pharus_cli %*
