import { readFileSync } from "fs";
import { google } from "googleapis";
import { Client, MessageEmbed, Snowflake, TextChannel } from "discord.js";
import 'dotenv/config';
import Parser from "rss-parser";

enum VidTypes {
  Video,
  Upcoming,
  Live
}

const youtube = google.youtube({ auth: process.env.GOOGLE_KEY, version: "v3" });

var config = JSON.parse(readFileSync('config.json').toString());
var isReady = false;
var client = new Client();
let interval: NodeJS.Timeout;
client.on("ready", () => {
  isReady = true;
});
let lastMessage: any;
const parser = new Parser();
function check(this: any): void {
  const that = this;
  console.log("check");
  parser
    .parseURL("https://www.youtube.com/feeds/videos.xml?channel_id=UC04QdEl71CFDogk8pzY7Geg")
    .then(({ items }) => {
      if (JSON.stringify(lastMessage) !== JSON.stringify(items[0])) {
        //console.log(JSON.stringify(lastMessage) + "vs" + JSON.stringify(items[0]))
        //console.log(items[0])
        lastMessage = items[0];
        //console.log((items[0].id as string).replace("yt:video:", ""))
        onVid((items[0].id as string).replace("yt:video:", ""), items[0].link as string)
        console.log("new"); 
      } else {
        console.log("not new");
      }
      setTimeout(check.bind(that), 10000);
    });
}
check();

function onVid(id: string, link: string) {
  // var vdid = link.match(
  //   /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  // );
  // //console.log(vdid);
  // if (vdid) {
  //var link = "https://youtube.com/" + id;

    //console.log(err);
    //var desc = response.data.items[0].snippet.description;
    
      getVidType(id).then((islive) => {
        console.log(islive)
        if (islive === VidTypes.Live) {
          newStream(link);
        } else if (islive === VidTypes.Upcoming){
          interval = setInterval(() => {
           getVidType(id).then((data) => {
              if (data == VidTypes.Live) {
                clearInterval(interval);
                newStream(link);
              }
            });
          }, 30000);
        } else if(islive == VidTypes.Video){
          newVideo(link);
        }
      }).catch(err => {
        console.log(err);
        
      })
     
  
}

if (config.streamlabs.enabled) {
  if (process.env.WS_KEY) {
    var streamlabs = require("socket.io-client")(
      `https://sockets.streamlabs.com?token=${process.env.WS_KEY}`
    );
    streamlabs.on("event", (slevent: any) => {
      switch (slevent.type) {
        case "subscription":
          if (slevent.for === "twitch_account") {
            sendMessage(
              config.channelids.donos,
              new MessageEmbed()
                .setTitle(
                  "Thanks for the subscription " + slevent.message[0].name
                )
                .setColor("#8400FF")
                .addFields(
                  { name: "Message", value: slevent.message[0].message },
                  { name: "Months", value: slevent.message[0].months }
                )
            );
          } else if (slevent.for === "youtube_account") {
            sendMessage(
              config.channelids.donos,
              new MessageEmbed()
                .setTitle(
                  "Thanks for becoming a member " + slevent.message[0].name
                )
                .setColor("#FF0000")
                .addFields({ name: "Months", value: slevent.message[0].months })
            );
          }
          break;
        case "donation":
          sendMessage(
            config.channelids.donos,
            new MessageEmbed()
              .setTitle("Thanks for donating " + slevent.message[0].from)
              .setColor("#80F5D2")
              .addFields(
                { name: "Amount", value: slevent.message[0].formatted_amount },
                { name: "Message", value: slevent.message[0].message }
              )
          );
          break;
        case "superchat":
          if (slevent.message[0].comment) {
            sendMessage(
              config.channelids.donos,
              new MessageEmbed()
                .setTitle(
                  "Thank you for the Superchat " + slevent.message[0].name
                )
                .setColor("#FF0000")
                .addFields(
                  { name: "Message", value: slevent.message[0].comment },
                  { name: "Amount", value: slevent.message[0].displayString }
                )
            );
          }
          break;
        default:
          break;
      }
      console.log(slevent);
    });
  } else console.log("No Streamlabs websocket key provided");
}

function sendMessage(chid: Snowflake, msg: string | MessageEmbed) {
  console.log('sendMessage called');
  
  if (isReady) {
    console.log("sendmessage called");
    (client.channels.cache.get(chid) as TextChannel).send(msg);
  }else {
    setTimeout(() => {
      if (isReady) {
        console.log("sendmessage called");
        (client.channels.cache.get(chid) as TextChannel).send(msg);
      }
    }, 5000)
  }
}
function newVideo(url: string) {
  sendMessage(
    config.channelids.videos,
    "ThirtyVirus posted a video! <@&" + config.roleids.videos + "> " + url
  );
}
function newStream(url: string) {
  sendMessage(
    config.channelids.streams,
    "ThirtyVirus has gone live! <@&" + config.roleids.streams + "> " + url
  );
}


function getVidType(id: string): Promise<VidTypes>{
  return new Promise<VidTypes>((resolve, reject) => {

    youtube.videos.list({ id: [id], part: ["snippet"] }).then((val) => {

      if(val.data !== undefined){
        const data = val.data;
        if(data.items !== undefined){
          if(data.items[0].snippet !== undefined){
            //console.log(data.items[0].snippet);
            
            const snippet = data.items[0].snippet;
            const type = snippet.liveBroadcastContent;
            if (type == "upcoming") {
              resolve(VidTypes.Upcoming)
            } else if (type == "live"){
              resolve(VidTypes.Live);
            } else if (type == "none"){
              resolve(VidTypes.Video)
            } else {
              reject(type)
            }
          }
        }
      }
    }).catch((err) => {
      reject(err)
    })
    
  });
}


client.login(process.env.BOT_TOKEN);
