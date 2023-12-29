
const WORKSPACE = '/Users/krzysztofi/Workspace'
const DOWNLOADS = '/Users/krzysztofi/Downloads'
const IL2CPP = '/opt/github/Il2CppDumper/Il2CppDumper/bin/Release/net6.0/osx-x64/publish/Il2CppDumper'
const R2COCOS = '/usr/local/bin/r2cocos'
const COCOSKEY: (file: string, dir: string) => string = (file: string, dir: string) => `fish -c 'cocos-key "${file}" "${dir}"'`;

export { WORKSPACE, DOWNLOADS, IL2CPP, R2COCOS, COCOSKEY }