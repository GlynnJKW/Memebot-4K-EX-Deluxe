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

var commands = {
  "ping": {
    "args": [],
    "desc": "Replies 'Pong!' to ping",
    "call": function(fn_args, fn_message){
      fn_message.reply("Pong!");
    },
    "authorized": function(fn_message){
      return true;
    }
  },
  "join": {
    "args": [],
    "desc": "Joins calling user's current voice channel",
    "call": function(fn_args, fn_message){
      if(fn_message.member.voiceChannel){
        bot_voicechannel = fn_message.member.voiceChannel;
        bot_connection = bot_voicechannel.join();
      }
      else{
        message.reply('Join a voice channel first!');
      }
    },
    "authorized": function(fn_message){
      return true;
    }
  },
  "leave": {
    "args": [],
    "desc": "Leaves voice channel if in one",
    "call": function(fn_args, fn_message){
      if(bot_voicechannel){
        bot_voicechannel.leave();
        bot_voicechannel = null;
      }
    },
    "authorized": function(fn_message){
      return true;
    }
  },
  "showqueue": {
    "args": [],
    "desc": "Shows queue of songs/files",
    "call": function(fn_args, fn_message){
      let queueString = "";
      for(let queueCount = 0; queueCount < playQueue.length; queueCount++){
        queueString += '\n' + playQueue[queueCount];
      }
      fn_message.reply(queueString);
    },
    "authorized": function(fn_message){
      return true;
    }
  },
  "skip": {
    "args": ["number"],
    "desc": "Skips # of songs/files provided, if none provided then default is 1",
    "call": function(fn_args, fn_message){
      if(currentlyPlaying){
        currentlyPlaying.end();
      }
    },
    "authorized": function(fn_message){
      return true;
    }
  },
  "play": {
    "args": ["filename"],
    "desc": "Adds file to queue if available, also joins calling user's voice channel if not already in a channel",
    "call": function(fn_args, fn_message){
      if(fn_message.member.voiceChannel && !bot_voicechannel && !currentlyPlaying){
        bot_voicechannel = fn_message.member.voiceChannel;
        bot_voicechannel.join().then(dyn_connection => {
          currentlyPlaying = dyn_connection.playFile('./audio/' + fn_args[0]);
          readyNextPlay(dyn_connection);
          //currentlyPlaying.on('end', end =>{
            //currentlyPlaying = null;
          //});
        });
      }
      else if(!currentlyPlaying){
        const broadcast = bot.createVoiceBroadcast();
        currentlyPlaying = broadcast.playFile('./audio/' + fn_args[0]);
        readyNextPlay(broadcast);
        //currentlyPlaying.on('end', end => {
          //currentlyPlaying = null;
        //});
        for (const connection of bot.voiceConnections.values()) {
          connection.playBroadcast(broadcast);
        }
      }
      else{
        fn_message.reply('added ' + fn_args[0] + ' to queue');
        playQueue.push(fn_args[0]);
        //console.log(currentlyPlaying._events.end.toString());
      }
    },
    "authorized": function(fn_message){
      return true;
    }
  },
  "alias":{
    "args": ["add/delete", "alias", "command"],
    "desc": "Adds/deletes alias of a command",
    "call": function(fn_args, fn_message){
      if(fn_args[0] == 'add'){
        let al_alias = fn_args[1];
        fn_args = fn_args.splice(2);
        aliases[al_alias] = fn_args;
      }
      else if(fn_args[0] == 'delete'){
        if(aliases[fn_args[1]]){
          delete aliases[fn_args[1]];
        }
      }
      fs.writeFile('aliases.json', JSON.stringify(aliases), 'utf8', function(){});
    },
    "authorized": function(fn_message){
      return true;
    }
  }
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
        let userPermissions = new Discord.Permissions(message.member, message.member.roles.reduce(function(a, c){return a | c.permissions}));
        var args = message.content.substring(1).split(' ');
        var cmd = args[0];

        args = args.splice(1);

        while(aliases[cmd]){
          args = aliases[cmd].concat(args);
          cmd = args[0];
          args = args.splice(1);
        }

        if(commands[cmd] && commands[cmd].authorized(message)){
          commands[cmd].call(args, message);
        }
    }
});
