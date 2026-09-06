Pod::Spec.new do |s|
  s.name           = 'PhotoThumbnail'
  s.version        = '1.0.0'
  s.summary        = 'Reads locally cached photo library thumbnails without touching the network.'
  s.description    = 'Exposes PHImageManager.requestImage so photos whose originals live in iCloud can still be shown on the map.'
  s.author         = 'Strollia'
  s.homepage       = 'https://github.com/kazuki19992/footspot'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: 'https://github.com/kazuki19992/footspot.git' }
  s.static_framework = true
  s.frameworks     = 'Photos', 'UIKit'

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
