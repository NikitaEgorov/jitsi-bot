import puppeteer from 'puppeteer';
import {exec} from 'child_process';
import fs from 'fs';
import {launch as launchBrowser, getStream as getPuppeteerStream, wss} from 'puppeteer-stream';
import moment from 'moment';

async function main(url) {

    const __dirname = import.meta.dirname;
    const id = moment().format('yyyy-MM-DD-HH-mm-ss');
    const fileName = __dirname + "/data/video-" + id + '.webm';

    console.log(`write to file ${fileName}`);

    console.log(`start browser - ${id}`);

    const browser = await launchBrowser({
        headless: false,
        executablePath: puppeteer.executablePath(),
        defaultViewport: {
            width: 1920,
            height: 1080,
        },
        args: [
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--autoplay-policy=no-user-gesture-required",
        ],
    });

    const context = browser.defaultBrowserContext();
    await context.clearPermissionOverrides();
    await context.overridePermissions(url.origin, ['camera', 'microphone', 'gyroscope', 'notifications', 'background-sync']);

    const page = await browser.newPage();

    console.log(`open address - ${id}`);

    await page.goto(url.href);

    // Connect as Guest
    await page.locator('.external').click()

    // Enter bot Name
    await page.locator('#enterDisplayName').fill(`Bot_${id}`);

    await page.click('div[data-testid="prejoin.joinMeeting"]', {waitUntil: "networkidle2"});

    console.log(`Wait in lobby - ${id}`);

    await page.waitForSelector('.lobby-screen-content', {hidden: true, waitUntil: "networkidle"});

    console.log(`Lobby - done - ${id}`);

    // Create file and start video stream
    const file = fs.createWriteStream(fileName);
    const stream = await getPuppeteerStream(page, {audio: true, video: true, frameSize: 1000});

    // Open chat panel
    const toolbox = await page.waitForSelector('div.toolbox-content-items > div.toolbar-button-with-badge > div.toolbox-button', {waitUntil: "networkidle"});
    await toolbox.click({waitUntil: "networkidle"});

    const charTextarea = await page.waitForSelector('textarea', {waitUntil: "networkidle"});

    await charTextarea.focus({waitUntil: "networkidle"});

    await page.type("textarea", "Record started");

    await page.keyboard.press('Enter');

    console.log(`Start recording - ${id}`);

    stream.pipe(file);

    setTimeout(async () => {

        await page.type("textarea", "Record finished");

        await page.keyboard.press('Enter');

        await stream.destroy();
        file.close();
        console.log(`finished - ${id}`);

        await browser.close();
        (await wss).close();

        // const ff = `ffmpeg -i ${fileName} -c:v libx265 -crf 18 -pix_fmt yuv420p -acodec aac -preset veryfast -y  ${fileName}.mp4"`;
        // console.log(ff);
        // const ffmpeg = exec(ff);

        // ffmpeg.stderr.on("data", (chunk) => {
        //     console.log(chunk.toString());
        // });

    }, 1000 * 30);
}

// node index.js http://meeting.com/room_111
await main(new URL(process.argv[2]));

