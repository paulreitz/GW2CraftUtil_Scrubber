# GW2 Crafting Util
## API Scribber
### Overview
The purpose of this utility is to pull all GW2 crafting recipes and associated items and push them to a local database that can be directly accessed from an Express server.

### Why SQL Server?
I know there are more popular databases out there, but there were three main reasons I chose SQL Server:
1. Even though I'm currently using the free version, the paid version supports JSON as a native data type.
2. It's stupid easy to push a local database to a live production database using SQL Server Management Studio
3. It's the one I have the most experience with, so I know what I'm doing (except for MySQL, but that didn't fit my needs).