@echo off

set ROOT_DIR=%~dp0..

where /q node || echo Node.js must be installed and available in PATH. 1>&2 && exit /b

if not exist %ROOT_DIR%\build\main.js (
    where /q npm || echo NPM must be installed and available in PATH. 1>&2 && exit /b

    echo [94mWelcome to Pharus!
    echo Performing first-time setup
    node %ROOT_DIR%/bin/setup.js %* || exit /b 1
    echo [0m
)

node %ROOT_DIR%/build/main.js %*
