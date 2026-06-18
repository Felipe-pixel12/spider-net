let dragging = false;
let verified = false;

const start =
document.getElementById("start");

const end =
document.getElementById("end");

const line =
document.getElementById("line");

function abrirCaptcha(){

    const user =
    document.getElementById("user").value;

    const pass =
    document.getElementById("pass").value;

    if(
        user.trim() === "" ||
        pass.trim() === ""
    ){
        alert(
            "Preencha usuário e senha."
        );
        return;
    }

    document
    .getElementById("captcha")
    .classList
    .remove("hidden");
}

start.addEventListener(
    "mousedown",
    () => {

        dragging = true;

        line.style.display =
        "block";
    }
);

document.addEventListener(
    "mousemove",
    (e) => {

        if(!dragging) return;

        const rect =
        start.getBoundingClientRect();

        const x1 =
        rect.left +
        rect.width / 2;

        const y1 =
        rect.top +
        rect.height / 2;

        const x2 =
        e.clientX;

        const y2 =
        e.clientY;

        const length =
        Math.hypot(
            x2 - x1,
            y2 - y1
        );

        const angle =
        Math.atan2(
            y2 - y1,
            x2 - x1
        ) * 180 / Math.PI;

        line.style.width =
        length + "px";

        line.style.left =
        x1 + "px";

        line.style.top =
        y1 + "px";

        line.style.transform =
        `rotate(${angle}deg)`;
    }
);

document.addEventListener(
    "mouseup",
    (e) => {

        if(!dragging) return;

        dragging = false;

        const target =
        end.getBoundingClientRect();

        if(
            e.clientX > target.left &&
            e.clientX < target.right &&
            e.clientY > target.top &&
            e.clientY < target.bottom
        ){

            verified = true;

            setTimeout(
                liberarAcesso,
                500
            );

        }else{

            line.style.display =
            "none";

            alert(
                "A teia não alcançou o alvo."
            );
        }
    }
);

function liberarAcesso(){

    if(!verified) return;

    document
    .getElementById("loginArea")
    .classList
    .add("hidden");

    document
    .getElementById("success")
    .classList
    .remove("hidden");
}