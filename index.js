/**
 * 静态服务器
 * 主要功能：
 * 1.静态资源目录设置,以及前缀替换；2.支持缓存；3.支持压缩处理；4.支持range
 *
 * 为了防止大文件，也为了满足zlib模块的调用模式，将读取文件改为流的形式进行读取。
 */

var http = require("http");
var url = require("url");
var path = require("path");
var fs = require("fs");
var mime = require("./mime").types;
var config = require("./config");
var utils = require("./utils");
var zlib = require("zlib");
const DIR = __dirname+"/static";

/*
* 前缀处理判断，如果使用前缀处理，url必须包含config中的前缀，否则默认为非法请求，返回404；
* */
var hasPrefix = function(url,prefix){
    return !!url.match(RegExp(prefix));
};
/*var prefixHandle = function(prefix,url){
    return url.replace(prefix,'');
};*/
var staticServer = http.createServer(function(request,response){
    response.setHeader("Server","Node/V8");
    response.setHeader("Accept-Ranges","bytes");
    var pathName = url.parse(request.url).pathname;
    if(pathName.slice(-1) ==="/"){
        pathName = pathName + config.Welcome.file;
    }
//    var realPath = path.join(__dirname+"/static",path.normalize(pathName.replace(/\.\./,"")));

    var compressHandle = function (raw,ext,statusCode, reasonPhrase) {
        var stream = raw;
        var acceptEncoding = request.headers['accept-encoding'] || "";
        var matched = ext.match(config.Compress.match);

        if (matched && acceptEncoding.match(/\bdeflate\b/)) {
            response.setHeader("Content-Encoding", "deflate");
            stream = raw.pipe(zlib.createDeflate());
        }else if (matched && acceptEncoding.match(/\bgzip\b/)) {
            response.setHeader("Content-Encoding", "gzip");
            stream = raw.pipe(zlib.createGzip());
        }
        statusCode = statusCode ? statusCode : 200;
        response.writeHead(statusCode, reasonPhrase);
        stream.pipe(response);
    };

    var handle = function (realPath) {
        fs.stat(realPath,function(err,stats){
            if(err){
                response.writeHead(404,"Not Found!",{'Content-Type':'text/plain'});
                response.write("This request URL " + pathName + " was not found on this server.");
                response.end();
            }else{
                if(stats.isDirectory()){
                    realPath = path.join(realPath,'/',config.Welcome.defaultFile);
                    handle(realPath);
                }else{
                    var extension = path.extname(realPath);
                    extension = extension ? extension.slice(1) : "unknown";
                    var contentType = mime[extension] || "text/plain";
                    response.setHeader("Content-Type",contentType);
                    response.setHeader("Content-Length",stats.size);

                    // Support Cache
                    var lastModified = stats.mtime.toUTCString();
                    response.setHeader("Last-Modified",lastModified);
                    if(extension.match(config.Expires.fileMatch)){
                        var expires = new Date();
                        expires.setTime(expires.getTime()+config.Expires.maxAge);
                        response.setHeader("Expires",expires.toUTCString());
                        response.setHeader("Cache-Control","max-age=" + config.Expires.maxAge);
                    }
                    if(request.headers["if-modified-since"] && request.headers["if-modified-since"]==lastModified){
                        response.writeHead(304,"Not Modified");
                        response.end();
                    }else {
                        if (request.headers["range"]) {
                            var range = utils.parseRange(request.headers["range"], stats.size);
                            if (range) {
                                response.setHeader("Content-Range", "bytes " + range.start + "-" + range.end + "/" + stats.size);
                                response.setHeader("Content-Length", (range.end - range.start + 1));
                                var raw = fs.createReadStream(realPath, {"start": range.start, "end": range.end});
                                compressHandle(raw,extension,206, "Partial Content");
                            } else {
                                response.removeHeader("Content-Length");
                                response.writeHead(416, "Request Range Not Satisfiable");
                                response.end();
                            }
                        } else {
                            var raw = fs.createReadStream(realPath);
                            compressHandle(raw,extension,200, "Ok");
                        }
                    }

                }
            }
        });
    }

    if(config.PREFIX){
        if(hasPrefix(pathName,config.PREFIX)){
            pathName = pathName.replace(config.PREFIX,'');
            var realPath = path.join(DIR,path.normalize(pathName));
            handle(realPath);
        }else{
            response.writeHead(404,"Not Found!",{'Content-Type':'text/plain'});
            response.write("This request URL " + pathName + " was not found on this server.");
            response.end();
        }
    }else{
        var realPath = path.join(DIR,path.normalize(pathName));
        handle(realPath);
    }
});
staticServer.listen(config.PORT);
console.log("static server run in port:" + config.PORT);