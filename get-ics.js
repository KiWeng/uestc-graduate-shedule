// ==UserScript==
// @name         电子科技大学研究生课表考表导出
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  以ICS格式导出电子科技大学研究生课表考表
// @author       KiWeng
// @match        https://yjsjy.uestc.edu.cn/pyxx/pygl/xkjg/*
// @match        https://yjsjy.uestc.edu.cn/pyxx/pygl/kskcxx/index*
// @require      https://cdn.jsdelivr.net/npm/ics-browser-gen@0.1.3/ics.deps.min.js
// @require      https://cdn.jsdelivr.net/npm/pikaday@1.8.2/pikaday.min.js
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    "use strict";

    let addStyle = (stylePath) => {
        var container = document.getElementsByTagName("head")[0];
        var addStyle = document.createElement("link");
        addStyle.rel = "stylesheet";
        addStyle.type = "text/css";
        addStyle.media = "screen";
        addStyle.href = stylePath;
        container.appendChild(addStyle);
    };
    addStyle("https://cdn.jsdelivr.net/npm/pikaday@1.8.2/css/pikaday.css");

    Date.prototype.format = (fmt) => {
        var o = {
            "M+": this.getMonth() + 1, //月份
            "d+": this.getDate(), //日
            "h+": this.getHours(), //小时
            "m+": this.getMinutes(), //分
            "s+": this.getSeconds(), //秒
            "q+": Math.floor((this.getMonth() + 3) / 3), //季度
            S: this.getMilliseconds(), //毫秒
        };
        if (/(y+)/.test(fmt)) {
            fmt = fmt.replace(
                RegExp.$1,
                (this.getFullYear() + "").substr(4 - RegExp.$1.length)
            );
        }
        for (var k in o) {
            if (new RegExp("(" + k + ")").test(fmt)) {
                fmt = fmt.replace(
                    RegExp.$1,
                    RegExp.$1.length == 1
                        ? o[k]
                        : ("00" + o[k]).substr(("" + o[k]).length)
                );
            }
        }
        return fmt;
    };

    let start_monday_date = new Date("2022-02-21");
    let week_date_table = []; // 本学期所有日期，默认到20周结束

    const timeTable = [
        // 硬编码时间表
        ["08:30", "09:15"], // startTime, endTime
        ["09:20", "10:05"],
        ["10:20", "11:05"],
        ["11:10", "11:55"],
        ["14:30", "15:15"],
        ["15:20", "16:05"],
        ["16:20", "17:05"],
        ["17:10", "17:55"],
        ["19:30", "20:15"],
        ["20:20", "21:05"],
        ["21:10", "21:55"],
        ["22:00", "22:45"],
    ];

    const xkjg = window.location.href.indexOf("xkjg") > -1 ? true : false;
    const kskcxx = window.location.href.indexOf("kskcxx") > -1 ? true : false;
    const cal = ics();

    let generate_button = () => {
        // 按钮生成
        let download_ics = document.createElement("button");
        download_ics.type = "button";
        download_ics.style = "margin-left:15px;height:30px;vertical-align:top";
        download_ics.className = "btn btn-xs btn-return ";
        download_ics.innerHTML =
            '<i class="icon-hdd  align-top bigger-150"></i>导出ics文件';

        if (xkjg) {
            let inserted_node = document.createElement("input");
            inserted_node.type = "text";
            inserted_node.id = "datepicker";
            inserted_node.placeholder = "请选择本学期第一周后再下载！";
            inserted_node.style = "width:200px;height:30px;margin-left:15px";
            document
                .getElementById("xq")
                .insertAdjacentElement("afterend", inserted_node);
            download_ics.disabled = "disabled";

            let date_chose = false;
            var picker = new Pikaday({
                field: document.getElementById("datepicker"),
                pickWholeWeek: true,
                firstDay: 1,
                onSelect: function (date) {
                    start_monday_date = new Date(date);
                    start_monday_date.setDate(
                        start_monday_date.getDate() -
                            ((start_monday_date.getDay() - 1 + 7) % 7)
                    );
                    week_date_table = [];
                    for (let i = 0; i < 20; i++) {
                        let week_arr = [];
                        for (let j = 0; j < 7; j++) {
                            let tmp_date = new Date(start_monday_date);
                            tmp_date.setDate(tmp_date.getDate() + 7 * i + j);
                            week_arr.push(tmp_date);
                        }
                        week_date_table.push(week_arr);
                    }
                    download_ics.disabled = "";
                    date_chose = true;
                },
            });
            picker;
        }

        if (xkjg) {
            document
                .getElementById("datepicker")
                .insertAdjacentElement("afterend", download_ics);
            download_ics.addEventListener("click", parse_xkjg);
        } else if (kskcxx) {
            document
                .getElementById("xqbh")
                .insertAdjacentElement("afterend", download_ics);
            download_ics.addEventListener("click", parse_kskcxx);
        }
    };

    let insert_weekly_events = (
        name,
        description,
        location,
        start_time,
        end_time,
        duration
    ) => {
        const rrule = new Object();
        rrule.freq = "WEEKLY";
        rrule.count = duration;
        cal.addEvent(name, description, location, start_time, end_time, rrule);
    };

    let parse_kskcxx = () => {
        const exams = document
            .getElementById("sample-table-1")
            .getElementsByTagName("tbody")[0].rows;
        for (let exam of exams) {
            if (exam.cells[11].innerText === "") continue;
            const exam_info = {
                name: exam.cells[5].innerText,
                roomNo: exam.cells[8].innerText,
                room: exam.cells[9].innerText,
                seatNo: exam.cells[10].innerText,
                time: exam.cells[11].innerText,
            };
            const description = `考场号：${exam_info["roomNo"]} 座位号：${exam_info["seatNo"]}`;

            const regex = /(\d+)-(\d+)-(\d+)日 (\d+):(\d+)~(\d+):(\d+)/gu;
            const time_info = regex.exec(exam_info["time"]);

            // 起止时间
            const event_start_time = new Date(
                parseInt(time_info[1]),
                parseInt(time_info[2]) - 1,
                parseInt(time_info[3]),
                parseInt(time_info[4]),
                parseInt(time_info[5])
            );
            const event_end_time = new Date(
                parseInt(time_info[1]),
                parseInt(time_info[2]) - 1,
                parseInt(time_info[3]),
                parseInt(time_info[6]),
                parseInt(time_info[7])
            );

            cal.addEvent(
                exam_info["name"],
                description,
                exam_info["room"],
                event_start_time.toUTCString(),
                event_end_time.toUTCString()
            );
        }

        cal.download();
    };

    let parse_xkjg = () => {
        const courses = document
            .getElementById("sample-table-1")
            .getElementsByTagName("tbody")[0].rows;
        for (let course of courses) {
            const course_info = {
                name: course.cells[3].innerText,
                teacher: course.cells[7].innerText,
                campus: course.cells[8].innerText,
                time_location: course.cells[9].innerText,
                description: course.cells[10].innerText,
            };
            const description = `任课教师：${course_info["teacher"]}
            班级说明：${course_info["description"]}`;

            for (let line of course_info["time_location"].split("\n")) {
                // Every line is like '1-10周，星期二第3-4节 星期四第3-4节 (二教307)'
                const re_loc = /\(([^)]+)\)/;
                const loc = re_loc.exec(line)[1];

                const re_duration = /(\d+)-(\d+)周/gu;
                const week_duration = re_duration.exec(line);

                const [start_week, end_week] = [
                    week_duration[1],
                    week_duration[2],
                ];

                const han2nubmer_week = {
                    一: 0,
                    二: 1,
                    三: 2,
                    四: 3,
                    五: 4,
                    六: 5,
                    日: 6,
                };
                const re_week = /星期([一二三四五六日])第(\d+)-(\d+)节/gu;
                const array = [...line.matchAll(re_week)];
                for (const element of array) {
                    const weekday_han = element[1];
                    const weekday = han2nubmer_week[weekday_han];
                    const [start_time, end_time] = [
                        timeTable[element[2] - 1][0],
                        timeTable[element[3] - 1][1],
                    ];

                    // 起止时间
                    const event_start_time = new Date(start_monday_date);
                    event_start_time.setDate(
                        event_start_time.getDate() +
                            (start_week - 1) * 7 +
                            weekday
                    );
                    event_start_time.setHours(start_time.split(":")[0]);
                    event_start_time.setMinutes(start_time.split(":")[1]);

                    const event_end_time = new Date(start_monday_date);
                    event_end_time.setDate(
                        event_end_time.getDate() +
                            (start_week - 1) * 7 +
                            weekday
                    );
                    event_end_time.setHours(end_time.split(":")[0]);
                    event_end_time.setMinutes(end_time.split(":")[1]);

                    const duration = end_week - start_week + 1;

                    insert_weekly_events(
                        course_info["name"],
                        description,
                        `${course_info["campus"]} ${loc}`,
                        event_start_time.toUTCString(),
                        event_end_time.toUTCString(),
                        duration
                    );
                }
            }
        }
        cal.download();
    };

    generate_button();
})();
