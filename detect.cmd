@echo off
:detectAnime
tasklist /v /fo:list | findstr ".avi .mkv .mp4" 
ping 1.1.1.1 -n 1 -w 1000 >nul
cls > nul
goto detectAnime