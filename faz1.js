const fs = require('fs');

let charCounter = 0;
start();

function start() {
    let signs = [
        "{", "}", "(", ")", "[", "]",
        ">=", "!=", "||", "&&", "!",
        "/", "%", "<", ">", "==", "<=",
        ";", ",", "=", "+", "-", "*"]
    let tokens = [];

    while (true) {
        let token = getNextChar();
        if (token === '' || token === undefined) { //end of file
            break;
        }

        if (signs.includes(token)) { //sign
            tokens.push(token);
        } else if (token === '#') {// comment
            do {
                token = getNextChar();
                if (token === '\n')//end of comment
                    break;
            } while (true)
        } else if (token !== " " && token !== '\n' && token !== '\r') {
            do {
                let nextToken = getNextChar();
                if (nextToken === "" || nextToken === undefined) { //end of file
                    break;
                }
                if (signs.includes(nextToken)) {//nextToken is a sign  e(
                    tokens.push(token);
                    tokens.push(nextToken);
                    break;
                } else if (nextToken === " ") {// )
                    tokens.push(token);
                    break;
                }
                token += nextToken; // nu
            } while (true)
        }
    }
    printTokens(tokens);
}

function getNextChar() {
    let testFile = fs.readFileSync('./teslangCode.txt', 'utf8');
    return testFile[charCounter++];
}

function printTokens(tokens) {
    for (let i = 0; i < tokens.length; i++) {
        console.log(tokens[i]);
    }
}
