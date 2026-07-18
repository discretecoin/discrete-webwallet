const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('discreteStorage', {
  listWallets() {
    return ipcRenderer.invoke('discrete-storage:listWallets');
  },
  loadWallet(walletId) {
    return ipcRenderer.invoke('discrete-storage:loadWallet', walletId);
  },
  saveWallet(walletId, encryptedBlob, metadata, activeWalletId) {
    return ipcRenderer.invoke('discrete-storage:saveWallet', walletId, encryptedBlob, metadata, activeWalletId);
  },
  deleteWallet(walletId) {
    return ipcRenderer.invoke('discrete-storage:deleteWallet', walletId);
  },
  renameWallet(walletId, name) {
    return ipcRenderer.invoke('discrete-storage:renameWallet', walletId, name);
  },
  setActiveWalletId(walletId) {
    return ipcRenderer.invoke('discrete-storage:setActiveWalletId', walletId);
  },
  saveVault(vault) {
    return ipcRenderer.invoke('discrete-storage:saveVault', vault);
  },
  exportWallet(walletId) {
    return ipcRenderer.invoke('discrete-storage:exportWallet', walletId);
  }
});
