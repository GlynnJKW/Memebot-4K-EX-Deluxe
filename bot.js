var Discord = require('discord.js');

var logger = require('winston');
var auth = require('./auth.json');
var aliases = require('./aliases.json');
var fs = require('fs');


// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';


// Initialize Discord Bot
var bot = new Discord.Client();

var bot_connection;
var bot_voicechannel;
var currentlyPlaying;
var playQueue = [];

var readyNextPlay = function(conn){
  currentlyPlaying.on('end', end => {
    if(playQueue[0]){
      currentlyPlaying = conn.playFile('./audio/' + playQueue[0]);
      playQueue.splice(0, 1);
      console.log(playQueue);
      readyNextPlay(conn);
    }
    else{
      currentlyPlaying = null;
    }
  });
};

bot.login(auth.token);

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});

bot.on('message', message => {
    // Our bot needs to know if it needs to execute a command
    // for this script it will listen for messages that will start with `!`
    //console.log(message);
    if (message.content.substring(0, 1) == '!') {
        var args = message.content.substring(1).split(' ');
        var cmd = args[0];

        args = args.splice(1);

        while(aliases[cmd]){
          args = aliases[cmd].concat(args);
          cmd = args[0];
          args = args.splice(1);
        }

        switch(cmd) {
            // !ping
            case 'ping':
                message.reply('Pong!');
                break;
            case 'join':
              if(message.member.voiceChannel){
                bot_voicechannel = message.member.voiceChannel;
                bot_connection = bot_voicechannel.join();
              }
              else{
                message.reply('Join a voice channel first!');
              }
              break;
            case 'leave':
              if(bot_voicechannel){
                bot_voicechannel.leave();
                bot_voicechannel = null;
              }
              break;
            case 'skip':
              if(currentlyPlaying){
                currentlyPlaying.end();
              }
              break;
            case 'showqueue':
              let queueString = "";
              for(let queueCount = 0; queueCount < playQueue.length; queueCount++){
                queueString += '\n' + playQueue[queueCount];
              }
              message.reply(queueString);
              break;
            case 'play':
              if(message.member.voiceChannel && bot_voicechannel != message.member.voiceChannel && !currentlyPlaying){
                bot_voicechannel = message.member.voiceChannel;
                bot_voicechannel.join().then(dyn_connection => {
                  currentlyPlaying = dyn_connection.playFile('./audio/' + args[0]);
                  readyNextPlay(dyn_connection);
                  //currentlyPlaying.on('end', end =>{
                    //currentlyPlaying = null;
                  //});
                });
              }
              else if(!currentlyPlaying){
                const broadcast = bot.createVoiceBroadcast();
                currentlyPlaying = broadcast.playFile('./audio/' + args[0]);
                readyNextPlay(broadcast);
                //currentlyPlaying.on('end', end => {
                  //currentlyPlaying = null;
                //});
                for (const connection of bot.voiceConnections.values()) {
                  connection.playBroadcast(broadcast);
                }
              }
              else{
                message.reply('added ' + args[0] + ' to queue');
                playQueue.push(args[0]);
                //console.log(currentlyPlaying._events.end.toString());
              }
              break;
            case 'alias':
              if(args[0] == 'add'){
                let al_alias = args[1];
                args = args.splice(2);
                aliases[al_alias] = args;
              }
              else if(args[0] == 'delete'){
                if(aliases[args[1]]){
                  delete aliases[args[1]];
                }
              }
              fs.writeFile('aliases.json', JSON.stringify(aliases), 'utf8', function(){});
              break;
            default:
        }
    }
});