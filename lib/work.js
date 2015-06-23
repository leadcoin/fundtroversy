// Redis replacement module
// Stores work data locally in filesystem

var fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    async = require('async'),
    log = require('./log'),
    storeRoot = path.join(__dirname, '../store');

function nop(){}

function stripJunk(hex) {
   return hex.replace(/[^a-f0-9]/g, '');
}

function hexToFilename(hex) {
   return stripJunk(hex).substr(2);
}

function hexToPath(hex) {
   return path.join(storeRoot, stripJunk(hex).substr(0, 2));
}

function hexToFullPath(hex) {
   return path.join(hexToPath(hex), hexToFilename(hex));
}

function readFileOrCleanup(file, cb) {
   var pkt;
   fs.readFile(file, function(err, buf) {
      if (err) {
         cb(err);
      } else {
         try {
            pkt = JSON.parse(buf.toString());
         } catch(e) {
            // ignore
         }
         if (pkt) {
            if (Date.now() <= pkt.expires) {
               // valid entry
               cb(null, pkt.data);
            } else {
               // expired entry, remove file
               fs.unlink(file, nop);
               cb();
            }
         } else {
            // Invalid JSON - broken data. Report as 'no entry' and remove file
            fs.unlink(file, nop);
            cb();
         }
      }
   })
}

function cleanup() {

   fs.readdir(storeRoot, function(err, list) {
      if (err) {
         log.error(err);
      } else {
         async.eachSeries(list, function(dir, dirDone) {

            var dirFull = path.join(storeRoot, dir);

            fs.readdir(dirFull, function(err, list) {
               if (err) {
                  dirDone(err);
               } else {
                  async.eachSeries(list, function(file, fileDone) {
                     readFileOrCleanup(path.join(dirFull, file), fileDone);
                  }, dirDone);
               }
            });

         }, function(err){
            if (err) {
               log.error(err);
            } else {
               log.info('Cleanup done');
            }
         });
      }
   })

}

// Cleanup old files every 30 minutes
setInterval(cleanup, 30 * 60 * 1000);

// Cleanup immediately on startup
cleanup();

module.exports = {
   setWork: function(hex, expire, data, cb) {
      cb = cb || nop;
      mkdirp(hexToPath(hex), function(err) {
         if (err) {
            cb(err);
         } else {
            fs.writeFile(
               hexToFullPath(hex),
               JSON.stringify({
                  // expire - in econds
                  expires: Date.now() + expire * 1000,
                  data: data
               }),
               cb
            );
         }
      })
   },
   getWork: function(hex, cb) {
      var fullPath = hexToFullPath(hex);
      readFileOrCleanup(fullPath, cb);
   }
};