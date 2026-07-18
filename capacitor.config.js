define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var config = {
        appId: 'cash.discrete.wallet',
        appName: 'Discrete Wallet',
        webDir: 'src',
        android: {
            allowMixedContent: true,
            backgroundColor: '#0d1115'
        },
        server: {
            androidScheme: 'https'
        },
        plugins: {
            StatusBar: {
                style: 'DARK',
                backgroundColor: '#0d1115'
            }
        }
    };
    exports.default = config;
});
