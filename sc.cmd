@echo off
set animeFile=%~nx1
dir /b /s "c:\users\%animeFile%" > animepath.txt
set /p animePath=<animepath.txt
:: del animePath.txt

:: Done finding the file
:: Generate random time and take screenshots

set /a rand1=%random% %%1000
set /a rand2=%random% %%1000

ffmpeg -ss "%rand1%" -i "%animePath%" -f image2 -vframes 1 "%animeFile%_%random%.jpg" > nul
ffmpeg -ss "%rand2%" -i "%animePath%" -f image2 -vframes 1 "%animeFile%_%random%.jpg" > nul

pause
