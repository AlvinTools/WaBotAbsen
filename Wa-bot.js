const fs = require("fs")
const mkdirp = require("mkdirp")
const { Client } = require("whatsapp-web.js");
const SESSION_FILE_PATH = "./session.json";
const PRESET_FILE_PATH = "./preset.js";
// const ABSEN_PAIR_FILE_PATH = "./rsc/Absen-pair.json"
const GROUP_PAIR_FILE_PATH = "./rsc/Group-pair.json"
const PERSONALIZED_KTP_FILE_PATH = "./rsc/Personalized-KTP.json" //IN PROGRESS
const TEMP_ABSEN_FILE_PATH = "./rsc/Absen-folder/"
const HIST_ABSEN_FILE_PATH = "./rsc/Absen-folder/History/"
const CPREFIX = "!";

let sessiondata;
let noSession
let playing = []

if(fs.existsSync(SESSION_FILE_PATH)){
    console.log("session route")
    sessiondata = require(SESSION_FILE_PATH);
} else {
    noSession = true
}

if(!fs.existsSync("rsc/Absen-folder/History")){
    console.log("masukSinidulu")
    mkdirp.sync("./rsc/Absen-folder/History")
}
if(!fs.existsSync(PERSONALIZED_KTP_FILE_PATH)){
    WRITE(PERSONALIZED_KTP_FILE_PATH, JSON.stringify([]))
}
// cek apakah sudah ada belum file Group-pair.json. kalau belum buat sebagai list dengan menambahkan 
if(!fs.existsSync(GROUP_PAIR_FILE_PATH)){
    WRITE(GROUP_PAIR_FILE_PATH, JSON.stringify([]))
}

const client = new Client({
    session: sessiondata
});

if(noSession){
    console.log("qr route")
    client.on("qr", (QR) => {
        console.log("QR RECEIVED", QR);
    });
}

client.on("authenticated", (session) => {
    sessiondata = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if(err){
            console.error(err);
        }
    });
});

client.on("auth_failure", msg =>{
    console.log('\n Event AUTH_FAILURE', new Date())
})

client.on("ready", () => {
    console.log("Client is ready!");
});


class KTP{
    constructor(id){
        this.id = id;
        this.noAbsen = null;
        this.nama = null;
        this.kelas = null
        this.agama = null
    }
    
    assign_nama(nama){
        this.nama = nama;
    }
}

class Group{
    constructor(id){
        this.idGroup = id
        this.namaGroup = null
            
        this.liveAbsenId = null     // id absen sedang berlangsung tidak memiliki Ditutup 
        this.lastAbsenId = null     // id absen terakhir

        this.lastSendJam = null
        this.lastSendMenit = null

        this.timerJamSend = -1
        this.timerMenitSend = -1
        this.timerJamEnd = -1
        this.timerMenitEnd = -1
        this.timerState = false
        this.running = false // menghindari adanya 2 running async function 

            // murid murid yang termasuk dalam grup, ditambahkan / diganti ketika melakukan command !register di suatu group chat
        this.muridList = []

    }

    assign_timer_send(timerJam, timerMenit){
        this.timerJamSend = timerJam
        this.timerMenitSend = timerMenit
    }
    assign_nama(nama){
        this.nama = nama
    }
}


// continue timer

let firstTimeContinueTimerOn = fs.existsSync(GROUP_PAIR_FILE_PATH) ? JSON.parse(READ(GROUP_PAIR_FILE_PATH)) : false
if(firstTimeContinueTimerOn != false){
    for(let [index, group] of firstTimeContinueTimerOn.entries()){
        if(group.running){
            isTimeToSend(index)
            isTimeToEnd(index)
        }
    }
}

client.on("message", msg => {
    try{
    if (msg.body.charAt(0) === CPREFIX){
        let commandLines = msg.body.split("\n")
        for(let commandLine of commandLines){
            let indexOfSpace = commandLine.includes(" ") ? commandLine.indexOf(" ") : commandLine.length
            let arg, who

            [command, arg] = [commandLine.slice(1, indexOfSpace), commandLine.slice(indexOfSpace + 1, commandLine.length)]
            command = command.toLowerCase()
            if(isFromGroup(msg)){
                // GROUP CHAT SPECIFIC COMMAND
                // command yang membutuhkan pemanggilan objek Group
                who = msg.author
                

                // mencari groupid dari Group-pair.json, asal pesan group akan disimpan dalam variable subjectGroup
                // kalau tidak ada di Group-pair.json akan ditambahkan objek Group dengan nilai properti semua null
                // kecuali this.groupid yang akan diisi dengan msg.from
                let subjectGroup
                let groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
                let adaGroup = false
                let indexOfSubjectGroup
                for(let [index, group] of groupPair.entries()){
                    console.log(JSON.stringify(group))
                    if(group.idGroup == msg.from){
                        subjectGroup = group
                        indexOfSubjectGroup = index
                        adaGroup = true
                        break
                    }
                } // kalau ga ada di Group-pair.json kita buat objek baru
                if(!adaGroup){
                    subjectGroup = new Group(msg.from)
                    indexOfSubjectGroup = groupPair.length
                }
                switch(command){
                    // sekedar mengirimkan command yang tersedia untuk group
                    case "h":
                    case "help":
                        helpGroup(msg)
                        break
                    // mengirimkan informasi / data yang tersimpan di Group-pair.json untuk group pengirim
                    case "ig":
                    case "info-group":
                        infoGroup(msg, arg, subjectGroup)                        
                        break
                    // melakukan sunting objek Group
                    case "spg":
                    case "set-property-group":
                        subjectGroup = setPropertyGroup(msg, arg, subjectGroup)                        
                        break
                    case "sktp":
                    case "setktp" :
                    case "set-ktp":
                        subjectGroup = setKTPGroup(msg, arg, subjectGroup)
                        break
                    case "a":
                    case "absen":
                        absenGroup(msg, arg, subjectGroup)
                        break
                    case "la":
                    case "liat-absen":
                        lihatAbsenGroup(msg, arg, subjectGroup)
                        break
                    case "liat-last-absen":
                    case "lihat-last-absen":
                    case "liat-absen-terakhir":
                    case "lihat-absen-terakhir":
                    case "lla":
                    case "lat":
                        lihatLastAbsenGroup(msg, arg, subjectGroup)
                        break

                    case "can":
                    case "create-absen-now":
                    case "create-absen":
                    case "ca":
                    case "cta":
                    case "create-temp-absen":
                    case "buat-absen":
                    case "buat-absensi":
                    case "ba":
                        subjectGroup = buatAbsenGroup(msg, arg, subjectGroup)
                        break
                    case "e":
                    case "ea":
                    case "end-absen":
                    case "end":
                        subjectGroup = endAbsenGroup(msg, arg, subjectGroup)
                        break

                    case "lm":
                    case "llm":
                    case "liat-list-murid":
                    case "lihat-list-murid":
                    case "liat-murid":
                    case "lihat-murid":
                        lihatMuridGroup(msg, arg, subjectGroup)
                        break
                    case "scl":
                    case "source-code-link":
                        msg.reply(
                            "https://github.com/Reylyer/WaBotAbsen"
                        )
                        break
                    case "lktp":
                    case "lk":
                    case "lihat-ktp":
                    case "liat-ktp":
                        lihatKTPGroup(msg, who, arg, subjectGroup)
                    case "import-ktp":
                    case "importktp":
                    case "iktp":
                    case "ik":
                        importKTPPersonalizedKeGroup()
                    case "bj":
                    case "blackjack":
                        blackJack()  //in progress
                    default:
                    
                }
                
                // SAVE STATE Group-pair.json
                if(subjectGroup.timerState && !subjectGroup.running){
                    subjectGroup.running = true
                    isTimeToSend(indexOfSubjectGroup)
                    isTimeToEnd(indexOfSubjectGroup)
                }
                if(subjectGroup.timerState == false){
                    subjectGroup.running = false
                }
                groupPair[indexOfSubjectGroup] = subjectGroup
                WRITE(GROUP_PAIR_FILE_PATH, JSON.stringify(groupPair))
                
            } else {
                // PC/DM SPECIFIC COMMAND
                who = msg.from
                let personalizedPair = JSON.parse(READ(PERSONALIZED_KTP_FILE_PATH))
                let indexOfSubjectPerson, subjectPerson
                let adaPerson = false
                for (let [index, person] of personalizedPair.entries()){
                    if(who == person.id){
                        indexOfSubjectPerson = index
                        subjectPerson = person
                        adaPerson = true
                    }
                }
                if(!adaPerson){
                    subjectPerson = new KTP(who)
                    indexOfSubjectPerson = personalizedPair.length
                }
                switch(command){
                    case "sktp":
                    case "setktp" :
                    case "set-ktp": // need msg arg subjectGroup
                        subjectPerson =  setKTPPC(msg, arg, subjectPerson)
                        break
                    case "bj":
                    case "blackjack":
                        
                    default:
                }
                personalizedPair[indexOfSubjectPerson] = subjectPerson
                WRITE(PERSONALIZED_KTP_FILE_PATH, JSON.stringify(personalizedPair))
            }
        }
    } 
        
    }catch(err){
        console.log(err)
    }
});

client.on("group_join", () => {
 
});


client.initialize();














































function helpGroup(msg){
    client.sendMessage(
        msg.from,
`command untuk group:
=> info-group
=> set-property-group
=> set-ktp
=> absen
=> liat-absen
=> liat-absen-terakhir
=> buat-absen
=> liat-murid
=> blackjack (N/A)
=> source-code-link

*command prefix adalah "!"
*gunakan flag(tambahkan) -h setelah nama command untuk melihat bantuan
contoh : !info-group -h`
    )
}

function infoGroup(msg, arg, subjectGroup){
    if(arg.includes("-h")){
        client.sendMessage(
            msg.from,
            "!info-group digunakan untuk mengirimkan informasi group yang di simpan oleh bot"
        )
    } else{
        client.sendMessage(
            msg.from,
`*id group*         : ${subjectGroup.idGroup}
namaGroup    : ${subjectGroup.namaGroup}
timerSend      : ${padZero2Digit(subjectGroup.timerJamSend)}:${padZero2Digit(subjectGroup.timerMenitSend)}
timerEnd        : ${padZero2Digit(subjectGroup.timerJamEnd)}:${padZero2Digit(subjectGroup.timerMenitEnd)}
statusTimer   : ${subjectGroup.timerState ? "On" : "Off"}
*jumlah murid terdaftar* : ${subjectGroup.muridList.length}

*yang di bold tidak dapat diganti/set lewat perintah`
        )
    }
}


function setPropertyGroup(msg, arg, subjectGroup){
    
    if(arg.includes("-h")){
        client.sendMessage(
            msg.from,
`!${command} digunakan untuk melakukan sunting properti objek 'Group' di group ini
properti yang bisa disunting antaralain:

timerSend     => "<angka>:<angka>" 
waktu absen dikirim

timerEnd       => "<angka>:<angka>" 
waktu absen dihapus

namaGroup   => <string>
sebagai pengenal Objek sekaligus digunakan dalam Header absen

timerState   => <boolean>
untuk mengaktifkan fitur auto send

contoh penggunaan:
!set-property-group timerSend 13:42
!set-property-group namaGroup sebuahNamaGroup
!set-property-group timerState false  // set menjadi Off
!set-property-group timerState True   // set menjadi On

perintah serupa:
!spg, !set-property-group` 
        )
    } else{
        let shrc = "subjectGroup"
        let indexOfSpaceArg = arg.includes(" ") ? arg.indexOf(" ") : arg.length
        let [property, value] = [arg.slice(0, indexOfSpaceArg), arg.slice(indexOfSpaceArg + 1, arg.length)]
        console.log(`property = ${property}, value = ${value}`)
        console.log(`property: ${property}, value: ${value}`)
        if(arg.includes(":")){
            let [timerJam, timerMenit] = value.split(":")
            let type
            if(property == "timerSend"){
                type = "Send"
            } else if(property == "timerEnd"){
                type = "End"
            }
            eval(`[${shrc}.timerJam${type}, ${shrc}.timerMenit${type} ] = [${timerJam}, ${timerMenit}]`)
        } else if(["namaGroup", "timerState"].includes(property)){
            if(property == "namaGroup"){
                eval(`${shrc}.${property} = value`)
                
            } else{
                eval(`${shrc}.${property} = (value === "true")`)
            }
            
        }
        msg.reply(
`properti ${property} telah disunting menjadi ${value}
info-group:
namaGroup    : ${subjectGroup.namaGroup}
timerSend      : ${padZero2Digit(subjectGroup.timerJamSend)}:${padZero2Digit(subjectGroup.timerMenitSend)}
timerEnd        : ${padZero2Digit(subjectGroup.timerJamEnd)}:${padZero2Digit(subjectGroup.timerMenitEnd)}
statusTimer   : ${subjectGroup.timerState ? "On" : "Off"}
jumlah murid terdaftar : ${subjectGroup.muridList.length}`
        )
        
    }
    return subjectGroup
}

function setKTPGroup(msg, arg, subjectGroup){
    if(arg.includes("-h")){
        client.sendMessage(
            msg.from,
`!${command} (Kartu Tanda Pelajar ) digunakan untuk mendaftar sekaligus menyunting properti objek Murid milik pengirim perintah
properti yang bisa di sunting:
nama    => <string>    untuk set nama
noAbsen =>  <number>      untuk set nomor absen

contoh penggunaan:
!set-KTP nama Shariyl Cross
!set-KTP noAbsen 69

perintah serupa:
!sktp, !setktp, !set-ktp`
        )
    } else {
        let indexOfSpaceArg = arg.includes(" ") ? arg.indexOf(" ") : arg.length
        let [property, value] = [arg.slice(0, indexOfSpaceArg), arg.slice(indexOfSpaceArg + 1, arg.length)]
        console.log(`property = ${property}, value = ${value}`)
        let index_murid
        let punya_ktp = false

        if(["nama", "noAbsen"].includes(property)){
            for(let [index, murid] of subjectGroup.muridList.entries()){
                if(murid.id == who){
                    punya_ktp = true
                    index_murid = index
                }
            }
            if(!punya_ktp){
                let ktpBaru = new KTP(who)
                subjectGroup.muridList.push(ktpBaru)
                indexMurid = subjectGroup.muridList.length - 1
                // if(property == "nama"){
                //     https://stackoverflow.com/questions/1129216/sort-array-of-objects-by-string-property-value
                //     subjectGroup.muridList.sort((a,b) => (a.nama > b.nama) ? 1 : ((b.nama > a.nama) ? -1 : 0))
                // } else if(property == "noAbsen"){
                //     subjectGroup.muridList.sort((a,b) => parseFloat(a.noAbsen) - parseFloat(b.noAbsen))
                // }
                // index_murid = subjectGroup.muridList.findIndex(x => x.id === who)
            }
            // https://stackoverflow.com/questions/12367126/how-can-i-get-a-substring-located-between-2-quotes
            // https://stackoverflow.com/questions/881085/count-the-number-of-occurrences-of-a-character-in-a-string-in-javascript
            // let value = (arg.match(/"/g) || [].length == 2) ? arg.match(/"([^']+)"/)[1] : arg.split(" ")[1]
            eval(`subjectGroup.muridList[${index_murid}].${property} = value`)
            msg.reply(
`properti ${property} telah disunting menjadi ${value}
KTP mu:
id             : ${subjectGroup.muridList[index_murid].id}
nama       : ${subjectGroup.muridList[index_murid].nama}
no absen : ${subjectGroup.muridList[index_murid].noAbsen}`
            )
            subjectGroup.muridList.sort((a,b) => {
                if(a == null){
                    return 1
                } else if(b == null){
                    return -1
                } else{
                    return parseFloat(a.noAbsen) - parseFloat(b.noAbsen)
                }
                
            })
            
        }
    }
    return subjectGroup
}

function absenGroup(msg, arg, subjectGroup){
    if(arg.includes("-h")){
        client.sendMessage(
            msg.from,
`!${command} digunakan untuk melakukan absen di absensi yang sedang berlangsun. Jika belum tolong lakukan 

perintah serupa:
!a, !absen`
        )
    } else{
        if(fs.existsSync(`${TEMP_ABSEN_FILE_PATH}${subjectGroup.liveAbsenId}`)){
            let listabsensi = READ(`${TEMP_ABSEN_FILE_PATH}${subjectGroup.liveAbsenId}`).split("\n")
            let adaMurid = false
            let indexMurid, lolos
            let text = ''
            for(let [index, murid] of subjectGroup.muridList.entries()){
                if(murid.id == who){
                    adaMurid = true
                    if(murid.nama != null && murid.noAbsen != null){
                        indexMurid = index
                        lolos = true
                    }
                    
                    break
                }
            }
            console.log(listabsensi)
            console.log(indexMurid)
            if(adaMurid && lolos){
                if(listabsensi[indexMurid + 3].endsWith("✅")){
                    msg.reply(
                        "anda sudah melakukan absen untuk hari ini"
                    )
                } else{
                    listabsensi[indexMurid + 3] = listabsensi[indexMurid + 3].concat("✅")
                    for(let x of listabsensi){
                        text = text.concat(`${x}\n`)
                    }
                    client.sendMessage(
                        msg.from,
                        text
                    )
                    WRITE(`${TEMP_ABSEN_FILE_PATH}${subjectGroup.liveAbsenId}`, text)
                }
            } else{
                msg.reply(
                    "tolong lakukan !set-KTP nama dan noAbsen terlebih dahulu"
                )
            }

        } else{
            msg.reply(
                "belum ada absen yang diinisialisasi"
            )
        }
        
    }
}


function lihatAbsenGroup(msg, arg, subjectGroup){
    if(arg.includes("-h")){
        msg.reply(
`!${command} digunakan untuk melihat absen yang sedang berlangsung. Berguna jika pengguna sudah melakukan absen

perintah serupa:
!la, !liat-absen`
        )
    } else{
        if(fs.existsSync(`${TEMP_ABSEN_FILE_PATH}${subjectGroup.liveAbsenId}`)){
            let text = READ(`${TEMP_ABSEN_FILE_PATH}${subjectGroup.liveAbsenId}`)
            client.sendMessage(
                msg.from,
                text
            )

        } else {
            msg.reply(
                "belum ada absen yang diinisialisasi"
            )
        }
    }
}

function lihatLastAbsenGroup(msg, arg, subjectGroup){
    if(arg.includes("-h")){
        msg.reply(
`!${command} digunakan untuk melihat satu absen yang lalu. 

perintah serupa:
!liat-absen-terakhir, !lihat-absen-terakhir, !lat, !liat-last-absen, !lihat-last-absen, !lla`
        )
    } else{
        if(fs.existsSync(`${HIST_ABSEN_FILE_PATH}${subjectGroup.idGroup}/${subjectGroup.lastAbsenId}`)){
            let text = READ(`${HIST_ABSEN_FILE_PATH}${subjectGroup.idGroup}/${subjectGroup.lastAbsenId}`)
            client.sendMessage(
                msg.from,
                text
            )

        } else {
            msg.reply(
                "belum pernah ada absen atau belum pernah absen sama sekali"
            )
        }
    }
}

function buatAbsenGroup(msg, arg, subjectGroup){
    if(arg.includes("-h")){
        msg.reply(
`!${command} digunakan untuk membuat absensi, murid yang membuat ktp setelah absen dikirim tidak akan muncul di absensi hingga absensi selanjutnya

perintah serupa:
!buat-absen, !buat-absensi, !ba, !create-absen, !create-absen-now, !ca, !can, !create-temp-absen, !cta`
        )
    } else{
        let text
        if(fs.existsSync(`${TEMP_ABSEN_FILE_PATH}${subjectGroup.liveAbsenId}`)){
            console.log("masuk ke sebelum execute moveTempAbsentoHistory")
            let lastAbsenId = moveTempAbsenToHistory(subjectGroup)
            subjectGroup.lastAbsenId = lastAbsenId
            text = fs.readFileSync(`${TEMP_ABSEN_FILE_PATH}${subjectGroup.liveAbsenId}`)
            msg.reply(
                `absen sebelum ini: \n${text}`
            )
            console.log("setelah execute moveTempAbsentoHistory")
            fs.unlinkSync(`${TEMP_ABSEN_FILE_PATH}${subjectGroup.liveAbsenId}`)
        }
        [text, subjectGroup.liveAbsenId] = createAbsen(subjectGroup)
        client.sendMessage(
            msg.from,
            text
        )
    }
    return subjectGroup
}

function endAbsenGroup(msg, arg, subjectGroup){
    if(arg.includes("-h")){
        msg.reply(
`!${command} digunakan untuk mengakhiri absen yang sedang berlangsung

perintah serupa:
!e, !ea, !end-absen, !end`
        )
    } else{
        if(fs.existsSync(`${TEMP_ABSEN_FILE_PATH}${subjectGroup.liveAbsenId}`)){
            console.log("masuk ke sebelum execute moveTempAbsentoHistory")
            let lastAbsenId = moveTempAbsenToHistory(subjectGroup)
            subjectGroup.lastAbsenId = lastAbsenId
            text = fs.readFileSync(`${TEMP_ABSEN_FILE_PATH}${subjectGroup.liveAbsenId}`)
            msg.reply(
                `absen ditutup: \n${text}`
            )
            console.log("setelah execute moveTempAbsentoHistory")
            fs.unlinkSync(`${TEMP_ABSEN_FILE_PATH}${subjectGroup.liveAbsenId}`)
        } else{
            msg.reply(
                "beluma ada absensi yang di inisialisasi"
            )
        }
    }
    return subjectGroup
}

function lihatMuridGroup(msg, arg, subjectGroup){
    if(arg.includes("-h")){
        msg.reply(
`!${command} digunakan untuk melihat list murid yang terdaftar di group dengan !set-ktp

gunakan flag -o untuk menampilkan penuh dalam bentuk JSON

perintah serupa:
!liat-list-murid, !lihat-list-murid, !liat-murid, !lihat-murid, !lm`
        )
    } else{
        let text = ''
        if(arg.includes("-o")){ 
            for(let murid of subjectGroup.muridList){
                text = text.concat(`${JSON.stringify(murid)}\n`)
            }

        } else if(subjectGroup.muridList.length != 0){
            for(let murid of subjectGroup.muridList){
                text = text.concat(`${murid.noAbsen}. ${murid.nama}\n`)
            }
        } else{
            text = text.concat("belum ada yang mendaftar")
        }
        client.sendMessage(
            msg.from,
            text
        )
    }
}

function lihatKTPGroup(msg, who, arg, subjectGroup){
    if(arg.includes("-h")){
        msg.reply(
`!${command} digunakan untuk melihat ktp anda yang sudah terdaftar di group ini

perintah serupa
!liat-ktp, !lihat-ktp, !lktp, !lk`
        )
    } else {
        let index_murid, punya_ktp
        for(let [index, murid] of subjectGroup.muridList.entries()){
            if(murid.id == who){
                punya_ktp = true
                index_murid = index
            }
        }
        if(!punya_ktp){
            msg.reply(
                "anda belum punya ktp silahkan gunakan perintah !set-ktp"
            )
        } else{
            msg.reply(
`KTP mu:
id             : ${subjectGroup.muridList[index_murid].id}
nama       : ${subjectGroup.muridList[index_murid].nama}
no absen : ${subjectGroup.muridList[index_murid].noAbsen}`
            )
        }
        
    }
}

function importKTPPersonalizedKeGroup(){
    
}









// PC

// need msg arg subjectGroup harusnya ga perlu subjectgroup perlunya PERSONALIZED-KTP need rework
function setKTPPC(msg, arg, subjectPerson){
    if(arg.includes("-h")){
        client.sendMessage(
            msg.from,
`!${command} (Kartu Tanda Pelajar) digunakan untuk mendaftar sekaligus menyunting properti objek Murid milik pengirim perintah 
properti yang bisa di sunting:
nama    => <string>    untuk set nama
noAbsen =>  <number>      untuk set nomor absen
kelas   =>  <string>     untuk set kelas 
agama   =>  <string>    untuk set agama (islam/kristen/katolik/hindu/buddha/konghucu/kepercayaan)

contoh penggunaan:
!${command} nama Shariyl Cross
!${command} noAbsen 69
!${command} kelas XII IPA 9
!${command} kelas XI IPS 6
!${command} agama kepercayaan

- !${command} bisa dilakukan cepat dengan melakukan multiline command namun terkadang saat menampilkan perubahan ada nilai properti yang tidak di perbaharui tetapi saat !lktp sudah terganti
- kalau ada absen lewat google form, nantinya akan ada tambahan properti NIS untuk melakukan absensi secara cepat lewat bot
- ktp ini sifatnya personal namun bisa digunakan untuk import ke group dengan menggunakan !import-ktp. properti nama dan noAbsen akan otomatis di salin ke grup yang lainnya untuk sekarang tidak. kalau noAbsen nya beda bisa menambahkan argumen di belakangnya e.g. !import-ktp 4 padahal set-ktp di PC 5.

perintah serupa:
!sktp, !setktp, !set-ktp`
        )
    } else {
        let indexOfSpaceArg = arg.includes(" ") ? arg.indexOf(" ") : arg.length
        let [property, value] = [arg.slice(0, indexOfSpaceArg), arg.slice(indexOfSpaceArg + 1, arg.length)]
        console.log(`property = ${property}, value = ${value}`)

        if(["nama", "noAbsen", "agama", "kelas"].includes(property)){
            eval(`subjectPerson.${property} = value`)

            msg.reply(
`properti ${property} telah disunting menjadi ${value}
KTP mu:
id             : ${subjectPerson.id}
nama       : ${subjectPerson.nama}
no absen : ${subjectPerson.noAbsen}
kelas      : ${subjectPerson.kelas}
agama        : ${subjectPerson.agama}`
            )
        }
    }
    return subjectPerson
}




















// ultilities

async function blackJack(){

}

/**
 * 
 * @param {*} conditionFunction     fungsi
 * @param {*} groupid               string groupid dari sebuah objek Group
 * @returns 
 * Fungsi ini akan mengembalikan nilai "OK" jika conditionFunction mengembalikan benar
 * 
 * dan akan mengembalikan nilai "STOP" jika group dengan groupid yang sama dengan groupid masukan memiliki properti this.timerState fals
 */
 function waitFor(indexGroup, sendOrEnd) {
    
    let timerState, running, group, timerJam, timerMenit
    console.log("masuk ke waitFor")
    const poll = (resolve) => {
        group = JSON.parse(READ(GROUP_PAIR_FILE_PATH))[indexGroup]
        console.log("masuk ke poll")
        timerState = group.timerState
        running = group.running
        if(sendOrEnd == "send"){
            timerJam = group.timerJamSend
            timerMenit = group.timerMenitSend
        } else if(sendOrEnd == "end"){
            timerJam = group.timerJamEnd
            timerMenit = group.timerMenitEnd
        }
        console.log(`timerState val = ${timerState}`)
        console.log(`running val = ${running}`)
        if(!timerState || !running){
            resolve("STOP")
        }else if((timerJam == jamSekarang() && timerMenit == menitSekarang())){
            resolve("OK")
        }
        else {
            setTimeout(_ => poll(resolve), 10000)
            console.log(`${jamSekarang()}:${menitSekarang()}:${detikSekarang()}`)
        }
        
    }
    
    return new Promise(poll);
}

/**
 * melakukan CLEAN WRITE
 * 
 * @param {*} PATH      PATH yang ditulis
 * @param {*} CONTENT   Konten yang mau di tulis
 * @returns 
 */
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
    return new Date().getMonth() + 1
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
https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// https://stackoverflow.com/questions/2998784/how-to-output-numbers-with-leading-zeros-in-javascript
function padZero2Digit(num){
    return String(num).padStart(2, '0')
}

function createAbsen(group){
    let sample = ""
    let header = `Absen kehadiran ${group.namaGroup} (${padZero2Digit(bulanSekarang())}/${padZero2Digit(tanggalSekarang())}/${tahunSekarang()})
ketik !absen untuk absen tapi tolong lakukan !set-KTP nama dan noAbsen terlebih dahulu

`
    console.log(`header val = ${header}`)
    sample = sample.concat(header)
    for(let murid of group.muridList){
        sample = sample.concat(`${murid.noAbsen}. ${murid.nama}\n`)
    }
    console.log(`sample val end = ${sample}`)
    let absenid = `${group.idGroup}\-${padZero2Digit(tanggalSekarang())}\-${padZero2Digit(bulanSekarang())}\-${tahunSekarang()}\-${padZero2Digit(jamSekarang())}\-${padZero2Digit(menitSekarang())}`
    console.log(`absen id = ${absenid}`)
    WRITE(`${TEMP_ABSEN_FILE_PATH}${absenid}`, sample)
    console.log("sebelum return")
    return [sample, absenid] // mengembalikan sample(text absen) dan juga absen id untuk liveabsenid
}
function moveTempAbsenToHistory(group){
    console.log("masuk ke moveTempAbsenToHistory")
    // gw butuh absenid, header yep
    let pindahan = READ(`${TEMP_ABSEN_FILE_PATH}${group.liveAbsenId}`)
    console.log(`pindahan val = ${pindahan}`)
    let absenid = `${group.idGroup}\-${padZero2Digit(tanggalSekarang())}\-${padZero2Digit(bulanSekarang())}\-${tahunSekarang()}\-${group.lastSendJam}\-${group.lastSendMenit}\-${padZero2Digit(jamSekarang())}\-${padZero2Digit(menitSekarang())}`
    console.log(`absen id val = ${absenid}`)
    if(!fs.existsSync(`${HIST_ABSEN_FILE_PATH}${group.idGroup}`)){
        mkdirp.sync(`${HIST_ABSEN_FILE_PATH}${group.idGroup}`)
    }
    WRITE(`${HIST_ABSEN_FILE_PATH}${group.idGroup}/${absenid}`, pindahan)
    console.log("sebelum return moveTempAbsenToHistory")
    return absenid
}

async function isTimeToSend(indexGroup){
    try{
        await sleep(1000)
        let groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
        let group = groupPair[indexGroup]
        console.log("masuk isTimeToSend")
        while(group.timerState){
            console.log("masuk while sebelum decision")
            let decision = await waitFor(indexGroup, "send")
            groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
            group = groupPair[indexGroup]
            console.log("setelah nilai decision didapat")
            if(decision == "OK"){
                console.log("masuk ke decision OK")
                // cek pertama kali atau bukan
                if(fs.existsSync(`${TEMP_ABSEN_FILE_PATH}${group.liveAbsenId}`)){
                    console.log("masuk ke sebelum execute moveTempAbsentoHistory")
                    let lastAbsenId = moveTempAbsenToHistory(group)
                    group.lastAbsenId = lastAbsenId
                    console.log("setelah execute moveTempAbsentoHistory")
                    fs.unlinkSync(`${TEMP_ABSEN_FILE_PATH}${group.liveAbsenId}`)
                }

                // buat absen sekaligus 
                // kirimin absennya
                let [absen, liveAbsenId] = createAbsen(group)
                console.log(`absen = ${absen}`)
                client.sendMessage(
                    group.idGroup,
                    absen
                )

                // update absenid
                group.liveAbsenId = liveAbsenId
                group.lastSendJam = padZero2Digit(jamSekarang())
                group.lastSendMenit = padZero2Digit(menitSekarang())
                groupPair[indexGroup] = group
                WRITE(GROUP_PAIR_FILE_PATH, JSON.stringify(groupPair))
                await sleep(60000)

            } else if(decision == "STOP"){
                break
            }
            
        }
        return

    } catch(err){
        console.log(err)
    }
}
async function isTimeToEnd(indexGroup){
    try{
        await sleep(1000)
        let groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
        let group = groupPair[indexGroup]
        console.log("masuk isTimeToSend")
        while(group.timerState){
            console.log("masuk while sebelum decision")
            let decision = await waitFor(indexGroup, "end")
            groupPair = JSON.parse(READ(GROUP_PAIR_FILE_PATH))
            group = groupPair[indexGroup]
            console.log("setelah nilai decision didapat")
            if(decision == "OK"){
                console.log("masuk ke decision OK")
                // cek pertama kali atau bukan
                let text //text adalah absen terakhir
                if(fs.existsSync(`${TEMP_ABSEN_FILE_PATH}${group.liveAbsenId}`)){
                    console.log("masuk ke sebelum execute moveTempAbsentoHistory")
                    let lastAbsenId = moveTempAbsenToHistory(group)
                    group.lastAbsenId = lastAbsenId
                    text = fs.readFileSync(`${TEMP_ABSEN_FILE_PATH}${group.liveAbsenId}`)
                    console.log("setelah execute moveTempAbsentoHistory")
                    fs.unlinkSync(`${TEMP_ABSEN_FILE_PATH}${group.liveAbsenId}`)
                }

                //kirim absenn terakhir
                console.log(`absen = ${text}`)
                client.sendMessage(
                    group.idGroup,
                    text
                )

                // update absenid
                group.liveAbsenId = null
                group.lastSendJam = null
                group.lastSendMenit = null
                groupPair[indexGroup] = group
                WRITE(GROUP_PAIR_FILE_PATH, JSON.stringify(groupPair))
                await sleep(60000)

            } else if(decision == "STOP"){
                break
            }
            
        }
        return

    } catch(err){
        console.log(err)
    }

}
