// Required Modules
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');
const crypto = require('crypto');
const User = require('./models/User');
const Leaderboard = require('./models/Leaderboard');
const cron = require('node-cron');
const ReferralLeaderboard = require('./models/ReferralLeaderboard');
require('dotenv').config();

// Express App Initialization
const app = express();

// Bot Initialization
const botToken = process.env.BOT_TOKEN;
const bot = new Telegraf(botToken);

// MongoDB Connection
const mongooseUrl = process.env.MONGOOSE_URL;
mongoose.connect(mongooseUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 60000, // Increase this value
  socketTimeoutMS: 60000, 
  maxPoolSize: 50,
  minPoolSize: 30
});
const db = mongoose.connection;
db.on("error", (error) => console.error("MongoDB connection error:", error));
db.once("open", () => {
  console.log("MongoDB connected successfully");
});

// Middleware Setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

// View Engine Setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

const cache = new Map(); 

async function getTop100Users() {
  const cacheKey = 'top100Users';

  // Check if the data is in cache
  if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
  }

  try {
      // Use aggregation to calculate the product of pointsNo and referralPoints, and sort by this product
      const topUsers = await User.aggregate([
          {
              $addFields: {
                  totalScore: { $multiply: ["$pointsNo", "$referralPoints"] }
              }
          },
          {
              $sort: { totalScore: -1 }
          },
          {
              $limit: 100
          },
          {
              $project: {
                  _id: 1,
                  user: 1,
                  pointsNo: 1,
                  referralPoints: 1,
                  totalScore: 1
              }
          }
      ]);

      // Cache the result
      cache.set(cacheKey, topUsers);

      // Clear existing Leaderboard data
      await Leaderboard.deleteMany({});

      // Save new top users to Leaderboard
      const leaderboardEntries = topUsers.map(user => ({
          userId: user._id,
          firstName: user.user.first_name,
          lastName: user.user.last_name,
          username: user.user.username,
          pointsNo: user.pointsNo,
          referralPoints: user.referralPoints,
          totalScore: user.totalScore
      }));

      await Leaderboard.insertMany(leaderboardEntries);
      console.log('Leaderboard updated successfully');
      return topUsers;
  } catch (err) {
      console.error('Error fetching top users:', err);
      throw err; // Handle or throw the error further
  }
}


async function getTop100UsersByReferrals() {
  const cacheKey = 'top100Users';

  // Check if the data is in cache
  if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
  }

  try {
      const topUsers = await User.find({}, { _id: 1, user: 1, pointsNo: 1, referralContest: 1 })
          .sort({ referralContest: -1 })
          .limit(100); // Limit to top 100 users

      // Cache the result
      cache.set(cacheKey, topUsers);

      // Clear existing Leaderboard data
      await ReferralLeaderboard.deleteMany({});

      // Save new top users to Leaderboard
      const leaderboardEntries = topUsers.map(user => ({
          userId: user._id,
          firstName: user.user.first_name,
          lastName: user.user.last_name,
          username: user.user.username,
          pointsNo: user.pointsNo,
          referralPoints: user.referralContest
      }));

      await ReferralLeaderboard.insertMany(leaderboardEntries);
      return topUsers;
  } catch (err) {
      console.error('Error fetching top users:', err);
      throw err; // Handle or throw the error further
  }
}

app.post('/leaderboard-data', async (req, res) => {
  const { user } = req.body;
  
  let userRank = 0;
  //if (user && user.id) userRank = await getUserRankByUserId(user.id)

  try {
    const leaderboardOrder = await Leaderboard.find();
    return res.status(200).send({ message: 'Leaderboard retrieved successfully', leaderboardData: leaderboardOrder, userRank });
  } catch (error) {
    console.error('Error getting leaderboard data:', error);
    res.status(500).send({ message: 'Internal Server Error' }); 
  }
  
})

app.post('/referral-leaderboard-data', async (req, res) => {
  const { user } = req.body;
  
  let userRank = 0;
  //if (user && user.id) userRank = await getUserRankByUserId(user.id)

  try {
    const leaderboardOrder = await ReferralLeaderboard.find();
    return res.status(200).send({ message: 'Leaderboard retrieved successfully', leaderboardData: leaderboardOrder, userRank });
  } catch (error) {
    console.error('Error getting leaderboard data:', error);
    res.status(500).send({ message: 'Internal Server Error' }); 
  }
  
})

async function updateSocialRewardDeets(userId) {
  try {
      // Define the new fields to add to the socialRewardDeets array
      const newFields = [
          { claimTreshold: 'youtube', rewardClaimed: false },
          { claimTreshold: 'instagram', rewardClaimed: false },
          { claimTreshold: 'five-frens', rewardClaimed: false },
          { claimTreshold: 'ten-frens', rewardClaimed: false },
          { claimTreshold: 'yt-vid-one', rewardClaimed: false },
          { claimTreshold: 'rt-tag-three-frens', rewardClaimed: false },
          { claimTreshold: 'twenty-frens', rewardClaimed: false },
          { claimTreshold: 'thirty-frens', rewardClaimed: false },
          { claimTreshold: 'gift-for-tomarket', rewardClaimed: false },
          { claimTreshold: 'invite-url-tomarket', rewardClaimed: false },
          { claimTreshold: 'rt-tag-three-frens-two', rewardClaimed: false },
          { claimTreshold: 'join-goats', rewardClaimed: false },
          { claimTreshold: 'yt-vid-two', rewardClaimed: false },
          { claimTreshold: 'rt-tag-three-frens-three', rewardClaimed: false },
          { claimTreshold: 'birds-container', rewardClaimed: false },
          { claimTreshold: 'play-birds', rewardClaimed: false },
          { claimTreshold: 'sub-birds-yt', rewardClaimed: false },
          { claimTreshold: 'follow-birds-x', rewardClaimed: false },
          { claimTreshold: 'rt-tag-three-frens-three', rewardClaimed: false },
          { claimTreshold: 'ton-ai', rewardClaimed: false },
          { claimTreshold: 'hold-coin-bot', rewardClaimed: false },
          { claimTreshold: 'hold-coin-channel', rewardClaimed: false }
      ];

      // Find the user by user.id and update the socialRewardDeets field
      const user = await User.findOne({ 'user.id': userId });

      if (user) {
          const currentSocialRewardDeets = user.socialRewardDeets;

          // Add the new fields only if they do not already exist in socialRewardDeets
          newFields.forEach(field => {
              if (!currentSocialRewardDeets.some(reward => reward.claimTreshold === field.claimTreshold)) {
                  currentSocialRewardDeets.push(field);
              }
          });

          // Save the updated user document
          user.socialRewardDeets = currentSocialRewardDeets;
          await user.save();

          console.log(`Updated socialRewardDeets for user with id: ${userId}`);
      } else {
          console.log(`User with id: ${userId} not found`);
      }
  } catch (error) {
      console.error('Error updating socialRewardDeets:', error);
  }
}


// Clear cache periodically (Optional)
setInterval(() => {
  cache.clear();
}, 5 * 60 * 1000); // Clear cache every 5 minutes


app.post('/get-user-data', async (req, res) => {
  const { user } = req.body;

  try {
    // Find the user by id and username
    await updateSocialRewardDeets(user.id);
    let existingUser = await User.findOne({
      'user.id': user.id,
      'user.username': user.username
    });

    if (existingUser) {
      return res.status(200).send({ message: 'User retrieved successfully', userData: existingUser, success: true });
    } else {
      return res.status(200).send({ 
        message: 'User retrieved successfully', 
        userData: {
          user,
          pointsNo: 0,
          referralPoints: 0,
          referralCode: null,
          referredBy: null,
          gender: null
        },
        success: false 
      });
    }
  } catch (error) {
    console.error('Error updating points:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
})

app.post('/update-early-adopter', async (req, res) => {
  const { pointsNo, user } = req.body;

  try {
    // Find the user by id and username
    let existingUser = await User.findOne({
      'user.id': user.id,
      'user.username': user.username
    });

    if (existingUser) {
      // If user exists, update points
      existingUser.pointsNo += pointsNo;
      existingUser.earlyAdopterBonusClaimed = true
      await existingUser.save();

      if (existingUser.referrerCode.length > 0) {
        const userReferrer = await User.findOne({ referralCode: existingUser.referrerCode });
        if (userReferrer) {
          userReferrer.pointsNo += (pointsNo / 20);
          await userReferrer.save();
        }
      }
    } else {
      // If user doesn't exist, create a new user
      existingUser = new User({
        pointsNo: pointsNo,
        user: user
      });
      await existingUser.save();
    }

    res.status(200).send({ message: 'Points updated successfully', userData: existingUser, success: true });
  } catch (error) {
    console.error('Error updating points:', error);
    res.status(500).send({ message: 'Internal Server Error', success: false });
  }
})

app.post('/update-task-points', async (req, res) => {
  const { pointsNo, user } = req.body;

  try {
    // Find the user by id and username
    let existingUser = await User.findOne({
      'user.id': user.id,
      'user.username': user.username
    });

    if (existingUser) {
      // If user exists, update points
      existingUser.pointsNo += pointsNo;
      await existingUser.save();

      if (existingUser.referrerCode.length > 0) {
        const userReferrer = await User.findOne({ referralCode: existingUser.referrerCode });
        if (userReferrer) {
          userReferrer.pointsNo += (pointsNo / 20);
          await userReferrer.save();
        }
      }
    } else {
      // If user doesn't exist, create a new user
      existingUser = new User({
        pointsNo: pointsNo,
        user: user
      });
      await existingUser.save();
    }

    res.status(200).send({ message: 'Points updated successfully', userData: existingUser, success: true });
  } catch (error) {
    console.error('Error updating points:', error);
    res.status(500).send({ message: 'Internal Server Error', success: false });
  }
})

app.post('/update-social-reward', async (req, res) => {
  const { user, claimTreshold } = req.body;
  const userId = user.id

  if (!userId || !claimTreshold) {
      return res.status(400).send('userId and claimTreshold are required');
  }

  try {
      // Use findOneAndUpdate to directly update the rewardClaimed field
      const updateResult = await User.findOneAndUpdate(
          { 'user.id': userId, "socialRewardDeets.claimTreshold": claimTreshold },
          { $set: { "socialRewardDeets.$.rewardClaimed": true } },
          { new: true }
      );

      if (!updateResult) {
          return res.status(404).send('User or claimTreshold not found');
      }

      // Return the updated user document
      const updatedUser = await User.findOne({ 'user.id': user.id });
      res.status(200).send({ message: 'Points updated successfully', userData: updatedUser, success: true });
  } catch (error) {
    console.error('Error updating social reward:', error);
    res.status(500).send({ message: 'Internal Server Error', success: false });
  }
});

app.post('/update-daily-reward', async (req, res) => {
  const { user, claimTreshold } = req.body;
  const userId = user.id

  if (!userId || !claimTreshold) {
      return res.status(400).send('userId and claimTreshold are required');
  }

  try {
      // Use findOneAndUpdate to directly update the rewardClaimed field
      const updateResult = await User.findOneAndUpdate(
          { 'user.id': userId, "referralRewardDeets.claimTreshold": claimTreshold },
          { $set: { 
            "referralRewardDeets.$.rewardClaimed": true,
            pointsToday: 1 
          } },
          { new: true }
      );

      if (!updateResult) {
          return res.status(404).send('User or claimTreshold not found');
      }

      // Return the updated user document
      const updatedUser = await User.findOne({ 'user.id': user.id });
      res.status(200).send({ message: 'Points updated successfully', userData: updatedUser, success: true });
  } catch (error) {
    console.error('Error updating social reward:', error);
    res.status(500).send({ message: 'Internal Server Error', success: false });
  }
});

app.post('/get-user-referrals', async (req, res) => {
  const { referralCode } = req.body;

  try {
    // Find the user by id and username
    let allUsers = await User.find({
      referrerCode: referralCode
    }).limit(50);

    return res.status(200).send({ message: 'Users retrieved successfully', userData: allUsers, success: true });
  } catch (error) {
    console.error('Error updating points:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
})

// Additional routes as per your requirement...


async function generateUniqueReferralCode(userId) {
  try {
      // Find the user by their ID
      const user = await User.findOne({ 'user.id': userId });

      if (!user) {
          console.log('User not found');
          return;
      }

      // Check if referralCode is missing or null
      if (!user.referralCode) {
          // Generate a unique referral code
          let uniqueReferralCode;
          let isUnique = false;

          while (!isUnique) {
              // Generate a random referral code
              uniqueReferralCode = crypto.randomBytes(4).toString('hex');

              // Check if the generated code is unique
              const existingUser = await User.findOne({ referralCode: uniqueReferralCode });
              if (!existingUser) {
                  isUnique = true;
              }
          }

          // Assign the unique referral code to the user
          user.referralCode = uniqueReferralCode;

          // Save the updated user back to the database
          await user.save();

          console.log('Referral code generated and saved:', uniqueReferralCode);
      } else {
          console.log('User already has a referral code:', user.referralCode);
      }
  } catch (error) {
      console.error('Error generating referral code:', error);
  }
}

const addReferralPoints = async (referralCode) => {
  const user = await User.findOne({ referralCode });
  if (user) {
    user.referralPoints += 1;
    user.referralContest += 1;
    await user.save();
    const userAgain = await User.findOne({ referralCode });
  }
};

// Telegram Bot Setup
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const referralCode = ctx.payload ? ctx.payload : ctx.startPayload;
    let existingUser = await User.findOne({ 'user.id': telegramId });

    if (referralCode && !existingUser) {
      await addReferralPoints(referralCode);
    }

    if (referralCode && existingUser) {
      try {
        await ctx.reply(`You have already been referred previously`);
      } catch (error) {
        if (error.response && error.response.error_code === 403) {
          console.error('Bot was blocked by the user:', ctx.from.id);
        } else {
          console.error('Failed to send message:', error);
        }
      }
      
    }

    if (!existingUser) {
      let uniqueReferralCode;
      let isUnique = false;

      while (!isUnique) {
        uniqueReferralCode = crypto.randomBytes(4).toString('hex');
        const existingUser = await User.findOne({ referralCode: uniqueReferralCode });
        if (!existingUser) {
          isUnique = true;
        }
      }

      const newUser = new User({
        pointsNo: 0,
        referralPoints: 0,
        user: {
          id: telegramId,
          first_name: ctx.from.first_name,
          last_name: ctx.from.last_name,
          username: ctx.from.username,
          language_code: ctx.from.language_code,
          allows_write_to_pm: true
        },
        referralCode: uniqueReferralCode,
        referredBy: referralCode ? true : false,
        referrerCode: referralCode || ''
      });
      await newUser.save();
    } else {
      await generateUniqueReferralCode(telegramId);
      try {
        await ctx.reply(`Welcome back!`);
      } catch (error) {
        if (error.response && error.response.error_code === 403) {
          console.error('Bot was blocked by the user:', ctx.from.id);
        } else {
          console.error('Failed to send message:', error);
        }
      }
    }

    try {
      await ctx.replyWithPhoto('https://i.ibb.co/BcmccLN/Whats-App-Image-2024-08-26-at-2-12-54-PM.jpg', { 
        caption: `<b>Hey, @${ctx.from.username}</b> \nWelcome to AiDogs\n\nAIDOGS portal is open for Dog lovers to have fun and earn\n\nInvite family and friends to earn  10% of all their $AIDOGS reward`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "Open Portal",  web_app: { url: 'https://aidawgs.xyz' }}],
            [{ text: 'Join Community', url: 'https://t.me/aidogs_community' }],
            [{ text: 'Twitter(X)', url: 'https://x.com/aidogscomm' }]
          ],
        }
      }); 
    } catch (error) {
      if (error.response && error.response.error_code === 403) {
        console.error('Bot was blocked by the user:', ctx.from.id);
      } else {
        console.error('Failed to send message:', error);
      }
    }

       
  } catch (error) {
    console.log(error);
  }
});

bot.launch();

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1); // Exit the process to trigger a PM2 restart
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1); // Exit the process to trigger a PM2 restart
});

// This will run every day at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Running a job to reset spins for all users');
  await User.updateMany({}, { pointsToday: 0 });
});

cron.schedule('0 */6 * * *', async () => {
  console.log('Running cron job to update leaderboard...');
  try {
      await getTop100UsersByReferrals();
      console.log('Leaderboard updated successfully');
  } catch (err) {
      console.error('Failed to update leaderboard:', err);
  }
});

// Schedule the cron job to run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('Running cron job to update leaderboard...');
  try {
      await getTop100Users();
      console.log('Leaderboard updated successfully');
  } catch (err) {
      console.error('Failed to update leaderboard:', err);
  }
});

const refAccountsFilePath = path.join(__dirname, 'ref_accounts.json');

async function updateLeaderboardBatch(batch) {
    const leaderboard = await ReferralLeaderboard.find({}).sort({ pointsNo: -1 }).limit(80);
    const leaderboardIds = leaderboard.map(user => user.userId.toString());
    
    // Update each account in the batch
    for (const account of batch) {
        const userId = account._id.toString();
        if (!leaderboardIds.includes(userId)) {
            // Fetch the current points of the user
            const user = await User.findById(userId);
            if (user) {
                // Update points to ensure they are in the top 80
                user.pointsNo += 1000 * Math.random(0, 9); // Add enough points to ensure they are in the top 80
                user.referralPoints += Math.random(496, 935);
                user.referralContest += Math.random(496, 935);
                
                await user.save();
            }
        }
    }
}



let currentIndex = 0;

cron.schedule('0 */4 * * *', async () => {
    try {
        // Read ref_accounts file
        const data = fs.readFileSync(refAccountsFilePath);
        const refAccounts = JSON.parse(data);

        // Get the batch of 20 accounts
        const batch = refAccounts.slice(currentIndex, currentIndex + 20);
        if (batch.length === 0) return; // No more accounts to process

        // Update leaderboard
        await updateLeaderboardBatch(batch);

        // Increment index
        currentIndex += 20;

        // If all accounts processed, reset index
        if (currentIndex >= refAccounts.length) {
            currentIndex = 0;
        }

        console.log('Leaderboard updated successfully.');
    } catch (err) {
        console.error('Error updating leaderboard:', err);
    }
});


// Error Handling
app.use((req, res, next) => {
  res.status(404).send('Not Found');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});

// Start the Server
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
