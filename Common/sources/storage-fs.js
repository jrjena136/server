/* * * (c) Copyright Ascensio System Limited 2010-2016 * * This program is freeware. You can redistribute it and/or modify it under the terms of the GNU  * General Public License (GPL) version 3 as published by the Free Software Foundation (https://www.gnu.org/copyleft/gpl.html).  * In accordance with Section 7(a) of the GNU GPL its Section 15 shall be amended to the effect that  * Ascensio System SIA expressly excludes the warranty of non-infringement of any third-party rights. * * THIS PROGRAM IS DISTRIBUTED WITHOUT ANY WARRANTY; WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR * FITNESS FOR A PARTICULAR PURPOSE. For more details, see GNU GPL at https://www.gnu.org/copyleft/gpl.html * * You can contact Ascensio System SIA by email at sales@onlyoffice.com * * The interactive user interfaces in modified source and object code versions of ONLYOFFICE must display  * Appropriate Legal Notices, as required under Section 5 of the GNU GPL version 3. * * Pursuant to Section 7 ยง 3(b) of the GNU GPL you must retain the original ONLYOFFICE logo which contains  * relevant author attributions when distributing the software. If the display of the logo in its graphic  * form is not reasonably feasible for technical reasons, you must include the words "Powered by ONLYOFFICE"  * in every copy of the program you distribute.  * Pursuant to Section 7 ยง 3(e) we decline to grant you any rights under trademark law for use of our trademarks. **/var fs = require('fs');var path = require('path');var mkdirp = require('mkdirp');var utils = require("./utils");var crypto = require('crypto');var configStorage = require('config').get('storage');var cfgBucketName = configStorage.get('bucketName');var cfgStorageFolderName = configStorage.get('storageFolderName');var cfgStorageExternalHost = configStorage.get('externalHost');var configFs = configStorage.get('fs');var cfgStorageFolderPath = configFs.get('folderPath');var cfgStorageSecretString = configFs.get('secretString');function getFilePath(strPath) {  return path.join(cfgStorageFolderPath, strPath);}function getOutputPath(strPath) {  return strPath.replace(/\\/g, '/');}function removeEmptyParent(strPath, done) {  if (cfgStorageFolderPath.length + 1 >= strPath.length) {    done();  } else {    fs.readdir(strPath, function(err, list) {      if (err) {        //не реагируем на ошибку, потому скорее всего эта папка удалилась в соседнем потоке        done();      } else {        if (list.length > 0) {          done();        } else {          fs.rmdir(strPath, function(err) {            if (err) {              //не реагируем на ошибку, потому скорее всего эта папка удалилась в соседнем потоке              done();            } else {              removeEmptyParent(path.dirname(strPath), function(err) {                done(err);              });            }          });        }      }    });  }}exports.getObject = function(strPath) {  return utils.readFile(getFilePath(strPath));};exports.putObject = function(strPath, buffer, contentLength) {  return new Promise(function(resolve, reject) {    var fsPath = getFilePath(strPath);    mkdirp(path.dirname(fsPath), function(err) {      if (err) {        reject(err);      } else {        //todo 0666        if (Buffer.isBuffer(buffer)) {          fs.writeFile(fsPath, buffer, function(err) {            if (err) {              reject(err);            } else {              resolve();            }          });        } else {          utils.promiseCreateWriteStream(fsPath).then(function(writable) {            buffer.pipe(writable);          }).catch(function(err) {            reject(err);          });        }      }    });  });};exports.listObjects = function(strPath) {  return utils.listObjects(getFilePath(strPath)).then(function(values) {    return values.map(function(curvalue) {      return getOutputPath(curvalue.substring(cfgStorageFolderPath.length + 1));    });  });};exports.deleteObject = function(strPath) {  return new Promise(function(resolve, reject) {    var fsPath = getFilePath(strPath);    fs.unlink(fsPath, function(err) {      if (err) {        reject(err);      } else {        //resolve();        removeEmptyParent(path.dirname(fsPath), function(err) {          if (err) {            reject(err);          } else {            resolve();          }        });      }    });  });};exports.deleteObjects = function(strPaths) {  return Promise.all(strPaths.map(exports.deleteObject));};exports.getSignedUrl = function(baseUrl, strPath, optUrlExpires, optFilename) {  return new Promise(function(resolve, reject) {    var userFriendlyName = optFilename ? encodeURIComponent(optFilename) : path.basename(strPath);    var uri = '/' + cfgBucketName + '/' + cfgStorageFolderName + '/' + strPath + '/' + userFriendlyName;    var url = (cfgStorageExternalHost ? cfgStorageExternalHost : baseUrl) + uri;    var date = new Date();    var expires = Math.ceil(date.getTime() / 1000) + (optUrlExpires || 604800);		// отключил время жизни т.к. существует сценарий, при котором объект	// получаемый по ссылке запрашивается после того как закончилось время	// его жизни.    var md5 = crypto.createHash('md5').update(/*expires + */uri + cfgStorageSecretString).digest("base64");    md5 = md5.replace(/\+/g, "-");    md5 = md5.replace(/\//g, "_");    url += ('?md5=' + md5 + '&expires=' + expires);    resolve(utils.changeOnlyOfficeUrl(url, strPath, optFilename));  });};