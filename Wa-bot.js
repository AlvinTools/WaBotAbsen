
const fs = require("fs")
const { Client } = require("whatsapp-web.js");
const SESSION_FILE_PATH = "./session.json";
const PRESET_FILE_PATH = "./preset.js";
const ABSEN_PAIR_FILE_PATH = "./Absen-pair.json"
const GROUP_PAIR_FILE_PATH = "./Group-pair.json"
const HEADER_FILE_PATH = "./Header.txt"
const TEMP_ABSEN_FILE_PATH = "./Temp-Absen.txt"
const CPREFIX = "!";

let timerJam, timerMenit, groupPair;
let select, absenPair, create;

let sessiondata;

if(fs.existsSync(SESSION_FILE_PATH)){
    sessiondata = require(SESSION_FILE_PATH);
} else {
    client.on("qr", (QR) => {
        console.log("QR RECEIVED", QR);
    });
}

const client = new Client({
    session: sessiondata
});

client.on("authenticated", (session) => {
    sessiondata = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if(err){
            console.error(err);
        }
    });
});



client.on("ready", () => {
    console.log("Client is ready!");
});


class Murid{
    constructor(id, absen){
        this.id = id;
        this.absen = absen;
        this.nama = null;
    }
    
    assign_nama(nama){
        this.nama = nama;
    }
}
class Group{
    constructor(id, nama){
        this.groupid = id
        this.nama = nama
        this.timerJamSend = null
        this.timerMenitSend = null
        this.timerJamEnd = null
        this.timerMenitEnd = null
        this.timerState = false
    }

    assign_timer_send(timerJam, timerMenit){
        this.timerJamSend = timerJam
        this.timerMenitSend = timerMenit
    }
    assign_nama(nama){
        this.nama = nama
    }
}

// let Mipa2;

// if (fs.existsSync(ABSEN_PAIR_FILE_PATH)){
    //     Mipa2 = require(ABSEN_PAIR_FILE_PATH)
    // }
function waitFor(conditionFunction, groupid) {
    let timerState
    let groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
    const poll = (resolve) => {
        groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
        for(let x of groupPair){
            if(x.groupid == groupid){
                timerState = x.timerState
            }
        }
        console.log(`condition function val = ${conditionFunction()}`)
        console.log(`timerState val = ${timerState}`)
        if(!timerState){
            resolve("err")
        }else if(conditionFunction()){
            resolve("OK")
        }
        else {
            setTimeout(_ => poll(resolve), 60000)
            console.log(`${jamSekarang()}:${menitSekarang()}:${detikSekarang()}`)
        }
    }
    
    return new Promise(poll);
}


function WRITE(PATH, CONTENT){
    fs.writeFileSync(PATH, CONTENT, function (err){
        if(err) throw err;
        console.log("file updated");
    });
    return;
}
function READ(PATH){
    return fs.readFileSync(PATH).toString("utf-8");
}
function isFromGroup(msg){
    if(!(msg.author == undefined)){
        return true
    }
    else{
        return false
    }
}
function tahunSekarang(){
    return new Date().getFullYear()
}
function bulanSekarang(){
    return new Date().getMonth()
}
function tanggalSekarang(){
    return new Date().getDate()
}
function jamSekarang(){
    return new Date().getHours()
}
function menitSekarang(){
    return new Date().getMinutes()
}
function detikSekarang(){
    return new Date().getSeconds()
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function isTimeToSend(groupid){
    //check
    try{
        let adaDiGroupPair = false
        let groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
        let timerMenit, timerJam
        for(let x of groupPair){
            if(x.groupid == groupid){
                adaDiGroupPair = true
                timerMenit = x.timerMenitSend
                timerJam = x.timerJamSend
                while(x.timerState){
                    console.log(`${timerJam}:${timerMenit} -before await`)
                    let decision = await waitFor(_ => ((jamSekarang() == timerJam) && (menitSekarang() == timerMenit)), groupid)
                    console.log(`decision val = ${decision}`)
                    if(decision == "OK"){
                        let header = `Absen kehadiran (${bulanSekarang() + 1}/${tanggalSekarang()}/${tahunSekarang()})\nketik !absen untuk absen tapi tolong lakukan !register terlebih dahulu\n\n`
                        WRITE(HEADER_FILE_PATH, header)
                        let absen = header
                        let listabsensi = READ("Template-Absen.txt").split("\r\n")
                        let tosave = '';
                        for(let x of listabsensi){
                            absen = absen.concat(`${x}\n`);
                            tosave = tosave.concat(`${x}\r\n`)
                        }
                        WRITE(TEMP_ABSEN_FILE_PATH, tosave)
                        client.sendMessage(groupid, `${absen}\ntriggered by timer\ntimer:${timerJam}:${timerMenit}`)
                        console.log(x.timerState)
                        await sleep(60000)
                    }
                        
                }
                break;
            }
        }
        if(!adaDiGroupPair){
            client.sendMessage(groupid, "register group terlebih dahulu untuk menggunakan fitur ini")
        }
        

    } catch(err){
        console.log(err)
    }
}
async function isTimeToEnd(groupid){
    try{
        let adaDiGroupPair = false
        let groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
        let timerMenit, timerJam
        for(let x of groupPair){
            if(x.groupid == groupid){
                adaDiGroupPair = true
                timerMenit = x.timerMenitEnd
                timerJam = x.timerJamEnd
                while(x.timerState){
                    console.log(`${timerJam}:${timerMenit} -before await`)
                    let decision = await waitFor(_ => ((jamSekarang() == timerJam) && (menitSekarang() == timerMenit)), groupid)
                    if(decision == "OK"){
                        client.sendMessage(groupid, `Absen di hapus\ntriggered by timer\ntimer:${timerJam}:${timerMenit}\nAbsen terakhir:`)
                        let text = READ(HEADER_FILE_PATH)
                        let listabsensi = READ(TEMP_ABSEN_FILE_PATH).split("\r\n")
                        for(x of listabsensi){
                            text = text.concat(`${x}\n`)
                        }
                        client.sendMessage(groupid, text)
                        fs.unlink(TEMP_ABSEN_FILE_PATH, function(err){
                            if (err) throw err;
                            console.log("file deleted")
                        })
                        groupPair = JSON.stringify(groupPair)
                        WRITE(GROUP_PAIR_FILE_PATH, groupPair)
                        await sleep(60000)
                    } else {
                        break
                    }
                }
                break;
            }
        }
        if(!adaDiGroupPair){
            client.sendMessage(groupid, "register group terlebih dahulu untuk menggunakan fitur ini")
        }

    } catch(err){
        console.log(err)
    }
}



client.on("message", msg => {

    if (msg.body.charAt(0) === CPREFIX){

        let indexOfSpace = msg.body.includes(" ") ? msg.body.indexOf(" ") : msg.body.length;
        
        [command, arg] = [msg.body.slice(1, indexOfSpace), msg.body.slice(indexOfSpace + 1, msg.body.length)];
        
        console.log(command);
        switch(command){
            // Sudah ping respon
            case "ping":
                client.sendMessage(msg.from, "pong");
                break;
           
            case "print-absen":
                client.sendMessage(msg.from, fs.readFile("./absen.txt"));
                break;
            
            // MAIN TASK
            case "buat-ulang":
                fs.unlink(TEMP_ABSEN_FILE_PATH, function(err){
                    if (err) throw err;
                    console.log("file recreated")
                })
                client.sendMessage(msg.from, "absen telah dibuat ulang")

            case "create-today-absen":                
                let header = `Absen kehadiran (${bulanSekarang() + 1}/${tanggalSekarang()}/${tahunSekarang()})\nketik !absen untuk absen tapi tolong lakukan !register terlebih dahulu\n\n`;
                WRITE(HEADER_FILE_PATH, header)
                create = true
                
            case "absen":
                try{
                    let iddigest;
                    if(isFromGroup(msg)){ // di group
                        iddigest = msg.author
                    } else {
                        iddigest = msg.from
                    }

                    let absen = READ(HEADER_FILE_PATH)
                    let listabsensi
                    absenPair = JSON.parse(READ(ABSEN_PAIR_FILE_PATH))
    
                    if(create){
                        listabsensi = READ("Template-Absen.txt").split("\r\n");
                        create = false
                    } else {
                        listabsensi = READ(TEMP_ABSEN_FILE_PATH).split("\r\n")
                    }
                    let sudahDaftar = false;
                    for(let x of absenPair){
                        if(x.id == iddigest){
                            sudahDaftar = true
                            console.log(listabsensi[x.absen-1])
                            if(listabsensi[x.absen-1].charAt(listabsensi[x.absen-1].length-1) == "✅"){
                                msg.reply("kamu sudah absen")
                            } else{
                                listabsensi[x.absen-1] = listabsensi[x.absen-1].concat("✅")
                            }
                            break;
                        }
                    }
                    console.log(listabsensi)
                    if(sudahDaftar){
                        let tosave = '';
                        for(let x of listabsensi){
                            absen = absen.concat(`${x}\n`);
                            tosave = tosave.concat(`${x}\r\n`)
                        }
                        WRITE(TEMP_ABSEN_FILE_PATH, tosave)
                        client.sendMessage(msg.from, absen)

                    } else {
                        if(!fs.existsSync(TEMP_ABSEN_FILE_PATH)){
                            let tosave = '';
                            for(let x of listabsensi){
                                tosave = tosave.concat(`${x}\r\n`)
                            }
                            WRITE(TEMP_ABSEN_FILE_PATH, tosave)
                        }
                        msg.reply("anda belum mendaftar. Tolong ketik *!register 'no absen'* tanpa tanda petik ")
                    }
                } catch(err){
                    console.log(err);
                }
                break;
            
            // sudah cek id berupa nomor hape
            case "myid":
                msg.reply( `${msg.author}`);
                break;
            
            case "rename":
                if(!fs.existsSync(ABSEN_PAIR_FILE_PATH)){
                    client.sendMessage(msg.from, "Belum ada file Absen-pair.json")
                }else{
                    absenPair = JSON.parse(READ(ABSEN_PAIR_FILE_PATH));
                    for(let x of absenPair){
                        try{
                            if(msg.author === x.id){
                                if(x.nama == null){
                                    msg.reply( `${msg.author} set nama menjadi ${arg}`)
                                }else{
                                    msg.reply(`nama diganti dari ${x.nama} menjadi ${arg}`)
                                }
                                x.nama = arg;
                                absenPair = JSON.stringify(absenPair);
                                WRITE(ABSEN_PAIR_FILE_PATH, absenPair)
                                break;
                            }
                        } catch(err){
                            console.log(err);
                        }
                    }

                }
                break;

            case "identify-group-by":
                
                if(isFromGroup(msg)){ //benar di group
                    if(!fs.existsSync(GROUP_PAIR_FILE_PATH)){
                        WRITE(GROUP_PAIR_FILE_PATH, JSON.stringify([" "]))
                    }
                    groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
                    let bernama = false
                    for(x of groupPair){
                        if(x.groupid == msg.from){
                            client.sendMessage(msg.from, `nama group diganti dari ${x.nama} menjadi ${arg}\ngroup_id: ${msg.from}`)
                            bernama = true
                            x.nama = arg
                            groupPair = JSON.stringify(groupPair);
                            WRITE(GROUP_PAIR_FILE_PATH, groupPair)

                        }
                    }
                    if(!bernama){
                        client.sendMessage(msg.from, `nama group di set menjadi ${arg}\ngroup_id: ${msg.from}`)
                        let newgroup = new Group(msg.from, arg)
                        groupPair.push(newgroup)
                        groupPair = JSON.stringify(groupPair);
                        WRITE(GROUP_PAIR_FILE_PATH, groupPair)

                    }

                }else{
                    client.sendMessage(msg.from, "ini bukan group")
                }
                break;
            
            
            // ERROR ON FIRST REGISTER
            case "register":
                try{
                    let iddigest;
                    if(isFromGroup(msg)){ // di group
                        iddigest = msg.author
                    } else {
                        iddigest = msg.from
                    }

                    if(!fs.existsSync(ABSEN_PAIR_FILE_PATH)){
                        WRITE(ABSEN_PAIR_FILE_PATH, JSON.stringify([" "]))
                    }
                    
                    absenPair = JSON.parse(READ(ABSEN_PAIR_FILE_PATH));
                    let appending = true;
                    for(let x of absenPair){ //test sudah ada apa belum
                        try{
                            console.log(`${iddigest} == ${x.id}`)
                            if(iddigest === x.id){
                                client.sendMessage(msg.from, `Absen diganti untuk ${iddigest} dari *${x.absen}* menjadi *${arg}*`);
                                appending = false;
                                x.absen = arg;
                                absenPair.sort((a,b) => parseFloat(a.absen) - parseFloat(b.absen));
                                absenPair = JSON.stringify(absenPair);
                                WRITE(ABSEN_PAIR_FILE_PATH, absenPair)
                                
                                break;
                            }
                        } catch(err){
                            console.log(err);
                        }
                    }
                    if(appending){
                        let newMem = new Murid(iddigest, arg);
                        absenPair.push(newMem);
                        absenPair.sort((a,b) => parseFloat(a.absen) - parseFloat(b.absen));
                        absenPair = JSON.stringify(absenPair);
                        WRITE(ABSEN_PAIR_FILE_PATH, absenPair)
                        client.sendMessage(msg.from, `terdaftar sebagai ${iddigest}, absen ${arg}`)
                    }
                } catch(err){
                    console.log(err)
                }
                break;


            case "setSendTime":
                try{
                    [timerJam, timerMenit] = arg.split(":")
                    timerJam = parseInt(timerJam)
                    timerMenit = parseInt(timerMenit)
                    console.log(`${timerJam}:${timerMenit} -setsend`)
                    if(!fs.existsSync(GROUP_PAIR_FILE_PATH)){
                        WRITE(GROUP_PAIR_FILE_PATH, JSON.stringify([" "]))
                    }
                    groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
                    let pernah = false
                        for(let x of groupPair){
                            if(x.groupid == msg.from){
                                client.sendMessage(msg.from, `timer send di set ${timerJam}:${timerMenit}\ngroup_id: ${msg.from}`)
                                pernah = true
                                x.timerJamSend = timerJam
                                x.timerMenitSend = timerMenit
                                x.timerState = true
                                groupPair = JSON.stringify(groupPair)
                                WRITE(GROUP_PAIR_FILE_PATH, groupPair)
                                isTimeToSend(x.groupid)

                            }
                        }
                        if(!pernah){
                            client.sendMessage(msg.from, `timer send di set ${timerJam}:${timerMenit}\ngroup_id: ${msg.from}`)
                            let newgroup = new Group(msg.from, arg)
                            newgroup.assign_timer_send(timerJam, timerMenit)
                            newgroup.timerState = true
                            groupPair.push(newgroup)
                            groupPair = JSON.stringify(groupPair)
                            WRITE(GROUP_PAIR_FILE_PATH, groupPair)
                            isTimeToSend(newgroup.groupid)
                        }
                    } catch(err){
                        console.log(err)
                    }
                break;
            case "setEndTime":
                try{
                    [timerJam, timerMenit] = arg.split(":")
                    timerJam = parseInt(timerJam)
                    timerMenit = parseInt(timerMenit)
                    console.log(`${timerJam}:${timerMenit} -setsend`)
                    if(!fs.existsSync(GROUP_PAIR_FILE_PATH)){
                        WRITE(GROUP_PAIR_FILE_PATH, JSON.stringify([" "]))
                    }
                    groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
                    let pernah = false
                        for(let x of groupPair){
                            if(x.groupid == msg.from){
                                client.sendMessage(msg.from, `timer end di set ${timerJam}:${timerMenit}\ngroup_id: ${msg.from}`)
                                pernah = true
                                x.timerJamEnd = timerJam
                                x.timerMenitEnd = timerMenit
                                groupPair = JSON.stringify(groupPair)
                                WRITE(GROUP_PAIR_FILE_PATH, groupPair)
                                isTimeToEnd(x.groupid)

                            }
                        }
                        if(!pernah){
                            client.sendMessage(msg.from, `timer end di set ${timerJam}:${timerMenit}\ngroup_id: ${msg.from}`)
                            let newgroup = new Group(msg.from, arg)
                            newgroup.assign_timer_send(timerJam, timerMenit)
                            newgroup.timerState = true
                            groupPair.push(newgroup)
                            groupPair = JSON.stringify(groupPair)
                            WRITE(GROUP_PAIR_FILE_PATH, groupPair)
                            isTimeToSend(newgroup.groupid)
                        }
                    } catch(err){
                        console.log(err)
                    }
                break;
            case "timerOn":
                try{
                    if(isFromGroup){
                        if(!fs.existsSync(GROUP_PAIR_FILE_PATH)){
                            WRITE(GROUP_PAIR_FILE_PATH, JSON.stringify([" "]))
                        }
                        groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
                        let ok = false
                            for(let x of groupPair){
                                if(x.groupid == msg.from){
                                    if(typeof x.timerJamSend == "number" && typeof x.timerMenitSend == "number"){
                                        ok = true
                                        x.timerState = true
                                        groupPair = JSON.stringify(groupPair)
                                        WRITE(GROUP_PAIR_FILE_PATH, groupPair)
                                        isTimeToSend(x.groupid)
                                        client.sendMessage(msg.from, `timer send dinyalakan\ntimer send: ${x.timerJamSend}:${x.timerMenitSend}\ntimer end: ${x.timerJamEnd}:${x.timerMenitEnd}\ngroup_id: ${msg.from}`)
                                        break
                                    }
                                }
                                
                            }
                            if(!ok){
                                client.sendMessage(groupid, "register group terlebih dahulu untuk menggunakan fitur ini") 
                            }
                    }else{
                        client.sendMessage(groupid, "fitur ini hanya ada di group") 
                    }
                } catch(err){
                    console.log(err)
                }
                break;
            case "timerOff":
                try{
                    if(isFromGroup){
                        if(!fs.existsSync(GROUP_PAIR_FILE_PATH)){
                            WRITE(GROUP_PAIR_FILE_PATH, JSON.stringify([" "]))
                        }
                        groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
                        let ok = false
                            for(let x of groupPair){
                                if(x.groupid == msg.from){
                                    if(typeof x.timerJamSend == "number" && typeof x.timerMenitSend == "number"){
                                        ok = true
                                        x.timerState = false
                                        groupPair = JSON.stringify(groupPair)
                                        WRITE(GROUP_PAIR_FILE_PATH, groupPair)
                                        isTimeToEnd(x.groupid)
                                        client.sendMessage(msg.from, `timer send dimatikan\ntimer send: ${x.timerJamSend}:${x.timerMenitSend}\ntimer end: ${x.timerJamEnd}:${x.timerMenitEnd}\ngroup_id: ${msg.from}`)
                                        break
                                    }
                                }
                                
                            }
                            if(!ok){
                                client.sendMessage(groupid, "register group terlebih dahulu untuk menggunakan fitur ini") 
                            }
                    } else{
                        client.sendMessage(groupid, "fitur ini hanya ada di group") 
                    }
                } catch(err){
                    console.log(err)
                }
                break;



            // sudah ez
            default:
                client.sendMessage(msg.from, `Tidak ada perintah '${command}' dalam list perintah`);

        }
    }
});

client.on("group_join", () => {
 
});


client.initialize();





/*
TO DO

absen remove auto trigger by time done not initiated
absen create auto trigger by time done so many bug endless sending 



absen by identifier and by group 50%

fixing fail first register done
fixing multiple checklist in done

separate absen-pair and group pair done not implemented

add more feature

integrate with g form


*/