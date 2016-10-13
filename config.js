exports.Expires = {
    fileMatch: /^(gif|png|jpg|js|css)$/ig,
    maxAge: 60*60*24*365
};
exports.Compress = {
    match: /css|html/ig
};
exports.Welcome = {
    defaultFile: "index.html"
};
exports.Timeout = 20 * 60 * 1000;
exports.Secure = null;
exports.PORT = 4008;
exports.PREFIX = "/static";

