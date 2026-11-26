import * as SecureStore from 'expo-secure-store';
const KEY='homesphere.gateway.v1',options={keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
export async function loadCredential(){const raw=await SecureStore.getItemAsync(KEY,options);return raw?JSON.parse(raw):null;}
export async function saveCredential(value){await SecureStore.setItemAsync(KEY,JSON.stringify(value),options);}
export async function clearCredential(){await SecureStore.deleteItemAsync(KEY,options);}
