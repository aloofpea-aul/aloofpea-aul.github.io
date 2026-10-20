import sys,re
src=open(sys.argv[1],encoding='utf-8').read()
a=src.count('SpreadsheetApp.getActiveSpreadsheet()'); b=src.count('DriveApp.getFolderById(CCL_FOLDER_ID)')
out=src.replace('SpreadsheetApp.getActiveSpreadsheet()','cclSS_()').replace('DriveApp.getFolderById(CCL_FOLDER_ID)','DriveApp.getFolderById(cclFolderId_())')
open(sys.argv[2],'w',encoding='utf-8').write(out)
print('replaced',a,b)
