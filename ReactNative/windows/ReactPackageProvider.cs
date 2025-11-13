using Microsoft.ReactNative;
using Microsoft.ReactNative.Managed;
using ReactNative.Modules; // ChatWindowManager 네임스페이스

namespace {{ namespace }}
{
  class ReactPackageProvider : IReactPackageProvider
  {
    public void CreatePackage(IReactPackageBuilder builder)
    {
      // 기존 자동 추가된 것들...

      // ★ 우리의 네이티브 모듈 추가 (Managed 특유의 ModuleProvider 사용)
      builder.AddModuleProvider<ChatWindowManager>();
    }
  }
}
