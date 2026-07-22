export var StorageType;
(function (StorageType) {
    StorageType["local"] = "local";
    StorageType["none"] = "none";
    StorageType["session"] = "session";
})(StorageType || (StorageType = {}));
var AbstractSDKRequest = (function () {
    function AbstractSDKRequest() {
    }
    return AbstractSDKRequest;
}());
export { AbstractSDKRequest };
var AbstractStorage = (function () {
    function AbstractStorage() {
    }
    return AbstractStorage;
}());
export { AbstractStorage };

export function formatUrl(protocol, url, query) {
    if (query === void 0) { query = {}; }
    var urlHasQuery = /\?/.test(url);
    var queryString = '';
    for (var key in query) {
        if (queryString === '') {
            !urlHasQuery && (url += '?');
        }
        else {
            queryString += '&';
        }
        queryString += key + "=" + encodeURIComponent(query[key]);
    }
    url += queryString;
    if (/^http(s)?\:\/\//.test(url)) {
        return url;
    }
    return "" + protocol + url;
}


