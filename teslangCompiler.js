const fs = require('fs');
const inputFile = fs.readFileSync("./input.txt", 'utf8');
let lineNumber = 1;
let tempLineNumber = 0;
let charCounter = 0;
let nextCharCounter = 0;
let jumpCharCounter = 0;
let symbolTable = [];
let regTable = [];
let token;
let scope = 1;
let regCounter = 0;
let labelCounter = 0;
start();

// nil implementation :
// nil testNil(....){
// .....
// .....
// return ..; //error -> function of type nil cannot have return statement
// }

function start() {
    createSymbolTable();
    token = getNextToken();
    prog();
}

function prog() {
    func();
    token = getNextToken();
    if (type() !== null) {
        prog();
    } else {
        console.error(`${lineNumber} : invalid type ${token} ,only num/list data types are allowed`);
    }
}

function func() {
    let typeResult = type();
    if (token === 'nil') {
        typeResult = 'nil';
    }
    if (typeResult !== null) {
        token = getNextToken();
        if (isWord(token) || token === 'main') {
            let funcName = token;
            let result = getFromSymbolTable(funcName, scope);
            if (result === null) {
                token = getNextToken();
                if (token === '(') {
                    token = getNextToken();
                    let funcArgTypes = flist([]);
                    if (token === ')') {
                        console.log(`proc ${funcName}`);
                        //main function cant have args and its return type in num
                        if (funcName === 'main') {
                            if (funcArgTypes.length > 0) {
                                funcArgTypes = [];
                                console.error(`${lineNumber} : main function cannot have arguments`);
                            }
                            if (typeResult !== 'num') {
                                console.error(`${lineNumber} : main function return type should be num`);
                            }
                        }
                        putInSymbolTable(funcName, 'func', scope, 0, funcArgTypes, typeResult);
                        token = getNextToken();
                        if (token === '{') {
                            scope++;
                            token = getNextToken();
                            body();
                            if (token === '}') {
                                regCounter = 0;
                                dropScopeTables(scope);
                                scope--;
                            } else {
                                console.error(`${lineNumber} : } is missed`);
                            }
                        } else {
                            console.error(`${lineNumber} : { is missed`);
                        }
                    } else {
                        console.error(`${lineNumber} : ) is missed`);
                    }
                } else {
                    console.error(`${lineNumber} : ( is missed`);
                }
            } else {
                console.error(`${lineNumber} : function ${result.name} already exist`);
            }
        } else if (isKeyword(token)) {
            console.error(`${lineNumber} : ${token} ,cannot redefine key words`);
        }
    } else {
        console.error(`${lineNumber} : invalid type ${token} ,only num/list data types are allowed`);
    }
}

function body() {
    stmt();
    token = getNextToken();
    if (type() !== null || isWord(token) || isKeyword(token)) {
        body();
    } else if (token !== '}') {
        console.error(`${lineNumber} : ${token} ,wrong body syntax`);
    }
}

function stmt() {
    if (isWord(token) || isNumber(token)) {
        expr();
        if (token !== ';') {
            console.error(`${lineNumber} : ; is missed`);
        }
    } else if (type() !== null) {
        defvar();
        token = getNextToken();
        if (token !== ';') {
            console.error(`${lineNumber} : ; is missed`);
        }
    } else if (token === 'if') { //if
        stmtIF();
    } else if (token === 'while') { //while
        stmtWHILE();
    } else if (token === 'for') { //for
        stmtFOR();
    } else if (token === 'return') { //return
        stmtRETURN();
    } else if (token === '{') { //body
        scope++;
        token = getNextToken();
        body();
        if (token === '}') {
            dropScopeTables(scope);
            scope--;
        } else {
            console.error(`${lineNumber} : } is missed`);
        }
    } else {
        console.error(`${lineNumber} : ${token} ,wrong stmt syntax`);
    }
}

function stmtRETURN() {
    token = getNextToken();
    let exprCall = expr();
    let result = exprCall.result;
    let returnType = result === null ? null :
        typeof result === 'number' ? 'num' :
            result.type === 'func' ? result.returnType :
                (result.type === 'list' && result.index && result.index.length > 0) ? 'num' :
                    result.type;

    let returnValue;
    if (result === null) {
        returnValue = null;
    } else if (typeof result === 'number') {
        returnValue = result;
    } else if (result.type === 'func') {
        returnValue = [0];
    } else if (result.type === 'num') {
        returnValue = result.value;
    } else {
        if (result.index && result.index.length > 0) {
            let index = result.index.pop();
            if (index >= result.value.length) {
                console.error(`${lineNumber} : ${index} ,out of list length index `);
                returnValue = undefined;
            } else {
                returnValue = result.value[index];
            }
        } else {
            returnValue = result.value;
        }
    }

    if (token === ';') {
        if (returnType !== null) {
            let thisFunction = getThisFunctionTable();
            let funcReturnType = thisFunction.returnType;
            if (funcReturnType === 'nil') {
                console.error(`${lineNumber} : return type of function ${thisFunction.name} is nil and cannot have return`);
            } else if (funcReturnType !== returnType) {
                console.error(`${lineNumber} : return type of function ${thisFunction.name} is ${funcReturnType}, but got ${returnType}`);
            } else {
                generateReleaseListMemoryCode(scope);
                generateReturnCode(result, returnValue);
            }
        } else {
            console.error(`${lineNumber} : function return type cannot be null`);
        }
    } else {
        console.error(`${lineNumber} : ; is missed`);
    }
}

function generateReleaseListMemoryCode(scope) {
    if (scope === 2) {
        scope--;
    }
    for (let i = 0; i < symbolTable.length; i++) {
        let thisTable = symbolTable[i];
        if (thisTable.scope >= scope && thisTable.type === 'list') {
            let reg = getFromRegTable(null, thisTable.name);
            console.log(`\t call  rel, ${reg.reg}`);
        }
    }
}

function generateReturnCode(result, returnValue) {
    let returnReg = getFromRegTable(null, result.name);
    if (typeof result !== "object") {
        console.log(`\t mov   r0, ${returnValue}`);
    } else if (returnReg && returnReg.reg !== 'r0') {
        console.log(`\t mov   r0, ${returnReg.reg}`);
    }
    console.log(`\t ret`);
}

function stmtIF() {
    token = getNextToken();
    if (token === '(') {
        token = getNextToken();
        let exprCall = expr();
        if (token === ')') {
            let ifEndLabel = Label();
            console.log(`\t jz   ${exprCall.resultReg}, ${ifEndLabel}`);
            token = getNextToken();
            stmt();
            if (getNextToken(false) === 'else') {
                console.log(`${ifEndLabel} :`);
                ifEndLabel = Label();
                console.log(`\t jnz   ${exprCall.resultReg} ,${ifEndLabel}`);
                dropToken();
                token = getNextToken();
                stmt();
            }
            console.log(`${ifEndLabel} :`);
        } else {
            console.error(`${lineNumber} : ) is missed`);
        }
    } else {
        console.error(`${lineNumber} : ( is missed`);
    }
}

function stmtWHILE() {
    token = getNextToken();
    if (token === '(') {
        let whileStartLabel = Label();
        console.log(`${whileStartLabel} :`);
        token = getNextToken();
        let exprCall = expr();
        if (token === ')') {
            let whileEndLabel = Label();
            console.log(`\t jz   ${exprCall.resultReg}, ${whileEndLabel}`);
            token = getNextToken();
            stmt();
            console.log(`\t jmp   ${whileStartLabel}`);
            console.log(`${whileEndLabel} :`);
        } else {
            console.error(`${lineNumber} : ) is missed`);
        }
    } else {
        console.error(`${lineNumber} : ( is missed`);
    }
}

function stmtFOR() {
    token = getNextToken();
    if (token === '(') {
        token = getNextToken();
        if (isWord(token)) {
            let searchResult = getFromSymbolTable(token, scope);
            if (searchResult === null) {
                let counterName = token;
                let reg = Reg();
                putInRegTable(reg, counterName);
                putInSymbolTable(counterName, 'num', scope);
                console.log(`\t mov  ${reg}, 0`);
                let forStartLabel = Label();
                let forEndLabel = Label();
                console.log(`${forStartLabel} :`);
                token = getNextToken();
                if (token === 'in') {
                    token = getNextToken();
                    let exprCall = expr();
                    let compareMemReg = Reg();
                    console.log(`\t mov   ${compareMemReg}, ${reg}`);
                    generateOperationsCode('*', 0, 8, compareMemReg, null);
                    generateOperationsCode('>=', 0, 0, compareMemReg, exprCall.resultReg);
                    console.log(`\t jz   ${compareMemReg}, ${forEndLabel}`);
                    if (token === ')') {
                        token = getNextToken();
                        stmt();
                        generateOperationsCode('+', 0, 1, reg, null);
                        console.log(`\t jmp   ${forStartLabel}`);
                        console.log(`${forEndLabel} :`);
                        dropIdentifier(counterName);
                    } else {
                        console.error(`${lineNumber} : ) is missed`);
                    }
                } else {
                    console.log(`${lineNumber} : in keyword is missed`);
                }
            } else {
                console.error(`${lineNumber} : variable ${searchResult.name} already exist`);
            }
        } else if (isKeyword(token)) {
            console.error(`${lineNumber} : ${token} ,cannot redefine key words`);
        }
    } else {
        console.error(`${lineNumber} : ( is missed`);
    }
}

function defvar() {
    let type = token;
    token = getNextToken();
    let result = getFromSymbolTable(token, scope);
    if (result === null) {
        let reg = Reg();
        putInRegTable(reg, token);
        putInSymbolTable(token, type, scope, 0);
    } else {
        console.error(`${lineNumber} : variable ${token} already exist`);
    }
}

function expr() {
    let exprCall1 = expr0();
    let finalResult = exprCall1.result;
    let resultReg = exprCall1.resultReg;
    if (finalResult === null) {
        return null;
    }

    while (token === '&&' || token === '||') {
        let operator = token;
        token = getNextToken();
        let exprCall2 = expr0();
        let exprRes2 = exprCall2.result;
        let resultReg2 = exprCall2.resultReg;
        if (operator === '&&') {
            resultReg = generateOperationsCode('&&', finalResult, exprRes2, resultReg, resultReg2);
            finalResult = finalResult && exprRes2;
        } else if (operator === '||') {
            resultReg = generateOperationsCode('||', finalResult, exprRes2, resultReg, resultReg2);
            finalResult = finalResult || exprRes2;
        } else {
            console.error(`${lineNumber} : ${operator} ,invalid operator`);
            finalResult = false;
        }
    }
    return {
        result: finalResult,
        resultReg: resultReg
    };
}

function expr0() {
    let operations = ['=', '>', '>=', '==', '!=', '<', '<='];
    let exprCall1 = expr1();
    let finalResult = exprCall1.result;
    let resultReg = exprCall1.resultReg;
    while (operations.includes(token)) {
        let operator = token;
        token = getNextToken();
        let exprCall2 = expr1();
        let exprRes2 = exprCall2.result;
        let resultReg2 = exprCall2.resultReg;
        if (operator === '=') {
            assignOperationAction(finalResult, exprRes2, resultReg, resultReg2);
        } else if (operator === '>') {
            resultReg = generateOperationsCode('>', finalResult, exprRes2, resultReg, resultReg2);
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 > result.value2);
        } else if (operator === '>=') {
            resultReg = generateOperationsCode('>=', finalResult, exprRes2, resultReg, resultReg2);
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 >= result.value2);
        } else if (operator === '==') {
            resultReg = generateOperationsCode('==', finalResult, exprRes2, resultReg, resultReg2);
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 === result.value2);
        } else if (operator === '!=') {
            resultReg = generateOperationsCode('!=', finalResult, exprRes2, resultReg, resultReg2);
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 !== result.value2);
        } else if (operator === '<') {
            resultReg = generateOperationsCode('<', finalResult, exprRes2, resultReg, resultReg2);
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 < result.value2);
        } else if (operator === '<=') {
            resultReg = generateOperationsCode('<=', finalResult, exprRes2, resultReg, resultReg2);
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 <= result.value2);
        } else {
            console.error(`${lineNumber} : ${operator} ,invalid operator`);
            finalResult = false;
        }
    }
    return {
        result: finalResult,
        resultReg: resultReg
    };
}

function assignOperationAction(exprRes1, exprRes2, resultReg, resultReg2) {
    let type1 = typeof exprRes1;
    let type2 = typeof exprRes2;
    let value1 = exprRes1;
    let value2 = exprRes2;
    let valueType1, valueType2;

    if (type1 === 'object') {
        if (exprRes1.type !== 'func') {
            value1 = exprRes1.value;// not needed
            valueType1 = exprRes1.type;
        } else {
            console.error(`${lineNumber} : left side of assign operator should be variable not function`);
            return;
        }
    } else if (type1 === 'number') {
        console.error(`${lineNumber} : left side of assign operator cannot be number`);
        return;
    } else {
        console.error(`${lineNumber} : error on left side of assign operator`);
        return;
    }


    if (exprRes2 !== null) {
        if (type2 === 'object') {
            if (exprRes2.type === 'func') {
                if (exprRes2.returnType === 'nil') {
                    console.error(`${lineNumber} : function ${exprRes2.name} on right side of assign operator has no return value`);
                    return;
                } else {
                    value2 = exprRes2.returnType === 'num' ? 0 : [0]; //return value for func is 0
                    valueType2 = exprRes2.returnType;
                }
            } else {
                if (exprRes2.type === 'list' && exprRes2.index && exprRes2.index.length > 0) {
                    let index = exprRes2.index.pop();
                    if (index >= exprRes2.value.length) {
                        console.error(`${lineNumber} : out of list length index on right side of assign operator`);
                        return;
                    } else {
                        value2 = exprRes2.value[index];
                        valueType2 = 'num';
                    }
                } else {
                    value2 = exprRes2.value;
                    valueType2 = exprRes2.type;
                }
            }
        } else if (type2 === 'number') {
            value2 = exprRes2;
            valueType2 = 'num';
        }
    } else if (type2 === 'string') {
        console.error(`${lineNumber} : there is an undefined variable on right side of assign operator`);
        return;
    } else {
        return;
    }


    if (valueType1 === valueType2) {
        //makelist : inner function
        if (exprRes2 &&
            exprRes2.name === 'makelist' &&
            exprRes2.callValues.length === 1) {
            let listSize = exprRes2.callValues[0];
            exprRes1.value = Array(listSize).fill(0);
            generateMakeListCode(exprRes1, exprRes2, resultReg, resultReg2, listSize);
        } else if (exprRes2 && exprRes2.name === 'numread') {
            generateNumreadCode(exprRes1);
            exprRes1.value = value2;
        } else {
            exprRes1.value = value2;
            generateAssignOperationCode(exprRes1, exprRes2, resultReg, resultReg2);
        }
    } else {
        if (valueType1 === 'list' && exprRes1.index && exprRes1.index.length > 0 && valueType2 === 'num') {
            let index = exprRes1.index.pop();
            if (index >= exprRes1.value.length) {
                console.error(`${lineNumber} : ${index} ,out of list length index on left side of assign operator `);
            } else {
                if (exprRes2 && exprRes2.name === 'numread') {
                    resultReg2 = generateNumreadCode(null);
                }
                exprRes1.value[index] = value2;
                generateAssignOnListCode(exprRes1, resultReg, index, exprRes2, resultReg2);
                if (exprRes2 && exprRes2.name === 'numread') {
                    dropReg(resultReg2, null);
                }
            }
        } else {
            console.error(`${lineNumber} : cannot put data of type :${valueType2} into variable of type :${valueType1}`);
        }
    }
}

function generateAssignOnListCode(result, resultReg, index, exprRes2, resultReg2) {
    let indexSize = result.indexRegs.length;
    let lastIndexReg = result.indexRegs[indexSize - 1];
    let positionReg = generateOperationsCode('*', index, 8, lastIndexReg, null);
    positionReg = generateOperationsCode('+', 0, index, positionReg, resultReg);
    let elementReg;
    if (resultReg2) {
        elementReg = resultReg2;
    } else if (exprRes2.name) {
        let reg1 = getFromRegTable(null, exprRes2.name);
        elementReg = reg1.reg;
    } else {
        elementReg = makeRegForConst(exprRes2);
    }
    console.log(`\t st    ${elementReg}, ${positionReg}`);
    dropReg(positionReg, null);
}

function generateMakeListCode(exprRes1, exprRes2, resultReg, resultReg2, listSize) {
    let arg = exprRes2.variableNames[0];
    let argReg;
    if (!isNaN(arg)) {
        argReg = null;
    } else {
        let reg = getFromRegTable(null, arg);
        argReg = reg.reg;
    }
    let memoryReg = generateOperationsCode('*', 8, listSize, null, argReg);
    console.log(`\t call  mem, ${memoryReg}`);
    generateAssignOperationCode(exprRes1, exprRes2, resultReg, memoryReg);
    dropReg(memoryReg, null);
}

function generateAssignOperationCode(exprRes1, exprRes2, resultReg, resultReg2) {
    if (resultReg && resultReg2) {
        console.log(`\t mov   ${resultReg}, ${resultReg2}`);
        return resultReg;
    } else {
        let reg1 = getFromRegTable(null, exprRes1.name);
        console.log(`\t mov   ${reg1.reg}, ${exprRes1.value}`);
        return reg1.reg;
    }
}

function generateNumreadCode(exprRes1) {
    let reg;
    if (exprRes1 === null) {
        reg = Reg();
        putInRegTable(reg, '');
    } else {
        reg = getFromRegTable(null, exprRes1.name).reg;
    }
    console.log(`\t call  iget, ${reg}`);
    return reg;
}

function expr1() {
    let exprCall1 = expr2();
    let finalResult = exprCall1.result;
    let resultReg = exprCall1.resultReg;
    while (token === '+') {
        token = getNextToken();
        let exprCall2 = expr2();
        let exprRes2 = exprCall2.result;
        let resultReg2 = exprCall2.resultReg;
        let res = handleIdentifierCheck(finalResult, exprRes2);
        if (res !== null) {
            resultReg = generateOperationsCode('+', finalResult, exprRes2, resultReg, resultReg2);
            finalResult = res.value1 + res.value2;
        } else {
            finalResult = null;
        }
    }
    return {
        result: finalResult,
        resultReg: resultReg
    };
}

function expr2() {
    let exprCall1 = expr3();
    let finalResult = exprCall1.result;
    let resultReg = exprCall1.resultReg;
    while (token === '-') {
        token = getNextToken();
        let exprCall2 = expr3();
        let exprRes2 = exprCall2.result;
        let resultReg2 = exprCall2.resultReg;
        let res = handleIdentifierCheck(finalResult, exprRes2);
        if (res !== null) {
            resultReg = generateOperationsCode('-', finalResult, exprRes2, resultReg, resultReg2);
            finalResult = (res.value1 - res.value2);
        } else {
            finalResult = null;
        }
    }
    return {
        result: finalResult,
        resultReg: resultReg
    };
}

function expr3() {
    let exprCall1 = expr4();
    let finalResult = exprCall1.result;
    let resultReg = exprCall1.resultReg;
    while (token === '*') {
        token = getNextToken();
        let exprCall2 = expr4();
        let exprRes2 = exprCall2.result;
        let resultReg2 = exprCall2.resultReg;
        let res = handleIdentifierCheck(finalResult, exprRes2);
        if (res !== null) {
            resultReg = generateOperationsCode('*', finalResult, exprRes2, resultReg, resultReg2);
            finalResult = (res.value1 * res.value2);
        } else {
            finalResult = null;
        }
    }
    return {
        result: finalResult,
        resultReg: resultReg
    };
}

function expr4() {
    let exprCall1 = expr5();
    let finalResult = exprCall1.result;
    let resultReg = exprCall1.resultReg;
    while (token === '/') {
        token = getNextToken();
        let exprCall2 = expr5();
        let exprRes2 = exprCall2.result;
        let resultReg2 = exprCall2.resultReg;
        let res = handleIdentifierCheck(finalResult, exprRes2);
        if (res !== null) {
            resultReg = generateOperationsCode('/', finalResult, exprRes2, resultReg, resultReg2);
            finalResult = Math.floor(res.value1 / res.value2);
        } else {
            finalResult = null;
        }
    }
    return {
        result: finalResult,
        resultReg: resultReg
    };
}

function expr5() {
    let exprCall1 = expr6();
    let finalResult = exprCall1.result;
    let resultReg = exprCall1.resultReg;
    while (token === '%') {
        token = getNextToken();
        let exprCall2 = expr6();
        let exprRes2 = exprCall2.result;
        let resultReg2 = exprCall2.resultReg;
        let res = handleIdentifierCheck(finalResult, exprRes2);
        if (res !== null) {
            resultReg = generateOperationsCode('%', finalResult, exprRes2, resultReg, resultReg2);
            finalResult = (res.value1 % res.value2);
        } else {
            finalResult = null;
        }
    }
    return {
        result: finalResult,
        resultReg: resultReg
    };
}

function generateOperationsCode(operation, finalResult, exprRes2, resultReg, resultReg2) {
    if (finalResult.type && finalResult.type === 'list') {
        resultReg = generateListCode(finalResult, resultReg);
    }
    if (exprRes2.type && exprRes2.type === 'list') {
        resultReg2 = generateListCode(exprRes2, resultReg2);
    }

    if (resultReg === null) {
        resultReg = makeRegForConst(finalResult, false);
    }
    let madeTempReg = resultReg2 === null;
    if (resultReg2 === null) {
        resultReg2 = makeRegForConst(exprRes2);
    }

    let temp;
    if (operation === '+') {
        temp = 'add';
    } else if (operation === '-') {
        temp = 'sub';
    } else if (operation === '*') {
        temp = 'mul';
    } else if (operation === '/') {
        temp = 'div';
    } else if (operation === '%') {
        temp = 'mod';
    } else if (operation === '==') {
        temp = 'comp=';
    } else if (operation === '!=') {
        console.log(`\t comp=   ${resultReg}, ${resultReg}, ${resultReg2}`);
        resultReg2 = makeRegForConst(0);
        temp = 'comp=';
    } else if (operation === '>') {
        temp = 'comp>';
    } else if (operation === '>=') {
        temp = 'comp>=';
    } else if (operation === '<') {
        temp = 'comp<';
    } else if (operation === '<=') {
        temp = 'comp<=';
    } else if (operation === '&&') {
        console.log(`\t add   ${resultReg}, ${resultReg}, ${resultReg2}`);
        resultReg2 = makeRegForConst(1);
        temp = 'comp=';
    } else if (operation === '||') {
        console.log(`\t add   ${resultReg}, ${resultReg}, ${resultReg2}`);
        resultReg2 = makeRegForConst(1);
        temp = 'comp>=';
    }
    console.log(`\t ${temp}   ${resultReg}, ${resultReg}, ${resultReg2}`);
    if (madeTempReg) {
        dropReg(resultReg2, null);
    }
    return resultReg;
}

function generateListCode(result, resultReg, customLastIndexReg = null) {
    let index = result.tempIndex;
    let indexSize = result.indexRegs.length;
    let lastIndexReg = (customLastIndexReg === null) ? result.indexRegs[indexSize - 1] : customLastIndexReg;
    let positionReg = generateOperationsCode('+', index, 1, lastIndexReg, null);
    positionReg = generateOperationsCode('*', index, 8, positionReg, null);
    positionReg = generateOperationsCode('+', 0, index, positionReg, resultReg);
    let elementReg = Reg();
    putInRegTable(elementReg, `${result.name}[${index}]`);
    console.log(`\t ld    ${elementReg} ,${positionReg}`);
    return elementReg;
}

function handleIdentifierCheck(exprRes1, exprRes2) {
    let value1 = exprRes1;
    let value2 = exprRes2;
    //--- null means error or not defined function // string means not defined variable
    if (exprRes1 !== null && exprRes2 !== null && typeof exprRes1 !== 'string' && typeof exprRes2 !== 'string') {
        let res1 = handleCheck(exprRes1, value1);
        value1 = res1.value;
        let valueType1 = res1.valueType;

        let res2 = handleCheck(exprRes2, value2);
        value2 = res2.value;
        let valueType2 = res2.valueType;

        if (value1 !== null && value2 !== null) {
            if (valueType1 === valueType2) {
                if (valueType1 === 'num') {
                    return {value1: value1, value2: value2};
                } else {
                    console.error(`${lineNumber} : cannot use operations on LIST data type`);
                    return null;
                }
            } else {
                console.error(`${lineNumber} : cannot use operations on different data types`);
                return null;
            }
        } else {
            return null;
        }
    } else {
        return null;
    }
}

function handleCheck(exprRes, value) {
    let valueType;
    if (typeof exprRes === 'object') {
        if (exprRes.type === 'func') {
            if (exprRes.returnType === 'nil') {
                value = null; // this function is type of void and doesnt return value
                valueType = null;
            } else {
                value = 0;//return value for func is 0
                valueType = exprRes.returnType;
            }
        } else {
            if (exprRes.type === 'list' && exprRes.index && exprRes.index.length > 0) {
                let index = exprRes.index.pop();
                if (index >= exprRes.value.length) {
                    console.error(`${lineNumber} : ${index} ,out of list length index `);
                    value = null;
                    valueType = null;
                } else {
                    value = exprRes.value[index];
                    valueType = 'num';
                    exprRes.tempIndex = index; //use for indexReg
                }
            } else {
                value = exprRes.value;
                valueType = exprRes.type;
            }
        }
    } else if (typeof exprRes === 'number') {
        value = exprRes;
        valueType = 'num';
    }
    return {value, valueType};
}

function expr6() {
    // return  number | symbolTable | string (new var) | null (not found func | error)
    if (isWord(token)) {
        let variableName = token;
        token = getNextToken();
        if (token === '(') { // iden (expr)
            let funcCallResult = handleClistCall(variableName);
            return {
                result: funcCallResult,
                resultReg: (funcCallResult && funcCallResult.returnType !== 'nil' && getLastReg()) ? getLastReg().reg : null
            };
        } else if (token === '[') { // iden [expr]
            let temp = exprExpr(variableName);
            return {
                result: temp.result,
                resultReg: temp.resultReg
            }
        } else {
            let searchResult = getFromSymbolTable(variableName, scope);
            let reg = getFromRegTable(null, variableName);
            if (searchResult !== null) {
                delete searchResult.index;
                return {
                    result: searchResult,
                    resultReg: reg.reg
                };
            } else {
                console.error(`${lineNumber} : variable ${variableName} doesnt exists`);
                return {
                    result: variableName,
                    resultReg: null
                };
            }
        }
    } else {
        return expr7();
    }
}

function expr7() {
    if (isNumber(token)) {// number
        let number = token;
        token = getNextToken();
        return {
            result: Number(number),
            resultReg: null
        };
    } else if (token === '!') { // !expr
        token = getNextToken();
        let exprCall = expr();
        return {
            result: !exprCall.result,
            resultReg: exprCall.resultReg
        }
    } else if (token === '-') {// -expr
        token = getNextToken();
        let exprCall = expr();
        return {
            result: -exprCall.result,
            resultReg: exprCall.resultReg
        }
    } else if (token === '+') { // +expr
        token = getNextToken();
        let exprCall = expr();
        return {
            result: +exprCall.result,
            resultReg: exprCall.resultReg
        }
    } else if (token === '(') { // (expr)
        token = getNextToken();
        let exprCall = expr();
        if (token === ')') {
            token = getNextToken();
            return {
                result: exprCall.result,
                resultReg: exprCall.resultReg
            }
        } else {
            console.error(`${lineNumber} : ) is missed`);
            return {
                result: null,
                resultReg: null
            }
        }
    } else if (isKeyword(token)) {
        console.error(`${lineNumber} : ${token} ,cannot redefine key words`);
        return {
            result: null,
            resultReg: null
        }
    } else {
        console.error(`${lineNumber} : ${token} syntax error`);
        return {
            result: null,
            resultReg: null
        }
    }
}

function exprExpr(variableName) {
    let searchResult = getFromSymbolTable(variableName, scope);
    if (searchResult && searchResult.index === undefined) {
        searchResult.index = [];
    }
    if (searchResult && searchResult.indexNames === undefined) {
        searchResult.indexNames = [];
    }
    if (searchResult && searchResult.indexRegs === undefined) {
        searchResult.indexRegs = [];
    }
    let errorReturn = {
        result: null,
        resultReg: null
    };
    if (searchResult === null) {
        console.error(`${lineNumber} : variable ${variableName} doesnt exists`);
        return errorReturn;
    } else if (searchResult.type !== 'list') {
        console.error(`${lineNumber} : expected ${variableName} to be of type list not ${searchResult.type}`);
        return errorReturn;
    }

    if (token === '[') {
        token = getNextToken();
        let exprCall = expr();
        let exprRes = exprCall.result;
        if (typeof exprRes === 'number') {
            searchResult.index.push(exprRes);
            searchResult.indexNames.push(exprRes);
            searchResult.indexRegs.push(exprCall.resultReg);
        } else if (typeof exprRes === 'object') {
            if (exprRes.type === 'func') {
                if (exprRes.returnType === 'nil') {
                    console.error(`${lineNumber} : return type of function ${exprRes.name} is nil and doesnt have return value`);
                    return errorReturn;
                } else if (exprRes.returnType === 'num') {
                    searchResult.index.push(0);
                    searchResult.indexNames.push(exprRes.name);
                    searchResult.indexRegs.push(exprCall.resultReg);
                } else {
                    console.error(`${lineNumber} : function ${exprRes.type} error`);
                    return errorReturn;
                }
            } else if (exprRes.type === 'num') {
                searchResult.index.push(exprRes.value);
                searchResult.indexNames.push(exprRes.name);
                searchResult.indexRegs.push(exprCall.resultReg);
            } else {
                console.error(`${lineNumber} : expected ${exprRes.name} to be of type num`);
                return errorReturn;
            }
        } else {
            console.error(`${lineNumber} : ${variableName} error`);
            return errorReturn;
        }

        if (token === ']') {
            token = getNextToken();
            let reg = getFromRegTable(null, variableName);
            return {
                result: searchResult,
                resultReg: reg.reg
            };
        } else {
            console.error(`${lineNumber} : ] is missed`);
            return errorReturn;
        }
    } else {
        console.error(`${lineNumber} : [ is missed`);
        return errorReturn;
    }
}

function handleClistCall(funcName) {
    let funcReturnType = null;
    let funcArgs = [];
    let searchResult = getFromSymbolTable(funcName, scope);
    if (searchResult !== null) {
        if (searchResult.type === 'func') {
            delete searchResult.index;
            if (searchResult.returnType === 'nil') {
                funcArgs = searchResult.args;
                funcReturnType = null;
            } else {
                funcArgs = searchResult.args;
                funcReturnType = searchResult.returnType;
            }
        } else {
            console.error(`${lineNumber} : expected ${funcName} to be function not ${searchResult.type}`);
            searchResult = null;
        }
    } else {
        console.error(`${lineNumber} : function ${funcName} doesnt exists`);
        searchResult = null;
    }
    token = getNextToken();
    let {types, variableNames} = clist(searchResult);
    if (token === ')') {
        token = getNextToken();
        if (funcReturnType || funcName === 'numprint') {
            if (types.length === funcArgs.length) {
                for (let i = 0; i < funcArgs.length; i++) {
                    if (funcArgs[i] !== types[i]) {
                        console.error(`${lineNumber} : function ${funcName} expected ${funcArgs[i]} arg type , got ${types[i]}`);
                        return null;
                    }
                }
                if (!isInnerFunction(funcName) || funcName === 'numprint') {
                    generateFunctionCallCode(searchResult, funcName, variableNames);
                }
            } else {
                console.error(`${lineNumber} : function ${funcName} expected ${funcArgs.length} args , got ${types.length}`);
                return null;
            }
        }
        return searchResult;
    } else {
        console.error(`${lineNumber} : ) is missed`);
        return null;
    }
}

function generateFunctionCallCode(functionTable, funcName, variableNames) {
    let registers = [];
    if (variableNames.length === 0) {
        let reg = Reg();
        putInRegTable(reg, funcName);
        registers.push(reg);
    }
    let argRegs = functionTable.argRegs;
    for (let i = 0; i < variableNames.length; i++) {
        if (!isNaN(variableNames[i])) {
            let reg = argRegs[i] ? argRegs[i] : makeRegForConst(variableNames[i], i !== 0, funcName);
            registers.push(reg);
            dropReg(null, 'numprint');
        } else {
            let arg = argRegs[i] ? getFromRegTable(argRegs[i], null) : getFromRegTable(null, variableNames[i]);
            if (i === 0) {
                putInRegTable(arg.reg, funcName);
            }
            registers.push(arg.reg);
            // if (i === 0) {
                // arg.reg = Reg();
            // }
        }
    }
    console.log(`\t call  ${funcName}, ${registers.join(', ')}`);
}

function flist(funcArgTypes) {
    let typeResult = type();
    if (typeResult !== null) {
        token = getNextToken();
        if (isWord(token)) {
            funcArgTypes.push(typeResult);
            let reg = Reg();
            putInRegTable(reg, token);
            if (typeResult === 'list') {
                putInSymbolTable(token, typeResult, scope, Array(10).fill(0));
            } else {
                putInSymbolTable(token, typeResult, scope);
            }
            token = getNextToken();
            if (token === ',') {
                token = getNextToken();
                return flist(funcArgTypes);
            } else {
                return funcArgTypes;
            }
        } else if (isKeyword(token)) {
            console.error(`${lineNumber} : ${token} ,cannot redefine key words`);
        }
    } else if (token === ')') {
        return [];
    } else {
        console.error(`${lineNumber} : invalid type ${token} , only num/list data types are allowed`);
    }
}

function clist(searchResult) {
    let callValues = [];
    let variableNames = [];
    let argRegs = [];
    let types = [];
    if (token === ')') {
        return {variableNames, types};
    }
    do {
        if (token === ',') {
            token = getNextToken();
        }
        let exprCall = expr();
        let exprRes = exprCall ? exprCall.result : null;
        if (exprRes === null) {
            return {variableNames, types};
        }
        if (typeof exprRes === 'object') {
            if (exprRes.type === 'func') {
                if (exprRes.returnType === 'nil') {
                    variableNames.push(null);
                    types.push(null);
                    callValues.push(0);
                    argRegs.push(null);
                } else {
                    variableNames.push(exprRes.name);
                    types.push(exprRes.returnType);
                    callValues.push(0);
                    argRegs.push(exprCall.resultReg);
                }
            } else {
                variableNames.push(exprRes.name);
                if (exprRes.type === 'list' && exprRes.index.length > 0) {
                    let res = handleCheck(exprRes, null);
                    types.push(res.valueType);
                    callValues.push(res.value);
                    let lastIndexName = exprRes.indexNames[exprRes.indexNames.length - 1];
                    let lastIndexReg;
                    if (!isNaN(lastIndexName)) {
                        lastIndexReg = null;
                    } else {
                        lastIndexReg = exprRes.indexRegs[exprRes.indexRegs.length - 1];
                        let tempReg = Reg();
                        putInRegTable(tempReg, '');
                        console.log(`\t mov   ${tempReg}, ${lastIndexReg}`);
                        lastIndexReg = tempReg;
                    }
                    let elementReg = generateListCode(exprCall.result, exprCall.resultReg, lastIndexReg);
                    argRegs.push(elementReg);
                } else {
                    types.push(exprRes.type);
                    callValues.push(exprRes.value);
                    argRegs.push(exprCall.resultReg);
                }
            }
        } else if (typeof exprRes === 'number') {
            variableNames.push(exprRes);
            types.push('num');
            callValues.push(exprRes);
            argRegs.push(exprCall.resultReg);
        } else {
            variableNames.push(null);
            types.push(null);
            callValues.push(null);
            argRegs.push(null);
        }
    } while (token === ',');

    if (searchResult !== null) {
        searchResult.callValues = callValues;
        searchResult.variableNames = variableNames;
        searchResult.argRegs = argRegs;
    }
    return {variableNames, types};
}

function type() {
    if (token === 'num' || token === 'list') {
        return token;
    }
    return null;
}

function isWord(input) {
    return !isKeyword(input) && input.match(/[a-zA-Z_][a-zA-Z_0-9]*/g) !== null;
}

function isNumber(input) {
    return !isNaN(input);
}

function isKeyword(input) {
    let keywords = ['if', 'else', 'while', 'exit', 'for', 'in', 'return', 'num', 'list'];
    return keywords.includes(input);
}

function isInnerFunction(input) {
    let innerFunctions = ['numread', 'numprint', 'makelist', 'listlen', 'exit'];
    return innerFunctions.includes(input);
}

function putInSymbolTable(name, type, scope, value = 0, args = null, returnType = '') {
    symbolTable.push({
        name: name,
        type: type,
        scope: scope,
        value: (type === 'list' && value === 0) ? [value] : value,
        index: [],
        args: args,
        returnType: returnType
    });
}

function getFromSymbolTable(name, scope) {
    for (let i = 0; i < symbolTable.length; i++) {
        let temp = symbolTable[i];
        if (temp.name === name && temp.scope <= scope) {
            return temp;
        }
    }
    return null;
}

function getThisFunctionTable() {
    for (let i = symbolTable.length - 1; i >= 0; i--) {
        if (symbolTable[i].scope === 1 &&
            symbolTable[i].type === 'func' &&
            !isInnerFunction(symbolTable[i].name)) {
            return symbolTable[i];
        }
    }
    return null;
}

function dropScopeTables(scope) {
    if (scope === 2) { //only functions remain in the table
        symbolTable = symbolTable.filter((thisTable) => thisTable.type === 'func');
        regTable = [];
    } else {
        symbolTable = symbolTable.filter((thisTable) => thisTable.scope < scope);
    }
}

function dropIdentifier(name) {
    symbolTable = symbolTable.filter((thisTable) => thisTable.name !== name);
}

function createSymbolTable() {
    symbolTable.push({
        name: 'numread',
        type: 'func',
        scope: 1,
        args: [],
        returnType: 'num',
    });
    symbolTable.push({
        name: 'numprint',
        type: 'func',
        scope: 1,
        args: ['num'],
        returnType: 'nil',
    });
    symbolTable.push({
        name: 'makelist',
        type: 'func',
        scope: 1,
        args: ['num'],
        returnType: 'list'
    });
    symbolTable.push({
        name: 'listlen',
        type: 'func',
        scope: 1,
        args: ['list'],
        returnType: 'num'
    });
    symbolTable.push({
        name: 'exit',
        type: 'func',
        scope: 1,
        args: ['num'],
        returnType: 'nil',
    });
}

function putInRegTable(reg, iden) {
    regTable.push({
        reg: reg,
        iden: iden,
    });
}

function getFromRegTable(reg, iden) {
    for (let i = 0; i < regTable.length; i++) {
        if ((reg === null || regTable[i].reg === reg) &&
            (iden === null || regTable[i].iden === iden)) {
            return regTable[i];
        }
    }
    return null;
}

function getLastReg() {
    return regTable[regTable.length - 1];
}

function dropReg(reg, iden) {
    if (reg !== null) {
        regTable = regTable.filter((thisReg) => thisReg.reg !== reg);
    } else if (iden !== null) {
        regTable = regTable.filter((thisReg) => thisReg.iden !== iden);
    }
    let biggestReg = 0;
    for (let i = 0; i < regTable.length; i++) {
        let thisReg = Number(regTable[i].reg.replace('r', ''));
        biggestReg = (thisReg > biggestReg) ? thisReg : biggestReg;
    }
    regCounter = biggestReg + 1;
}

function getNextToken(drop = true) {
    let signs = [
        "{", "}", "(", ")", "[", "]",
        ">=", "!=", "||", "&&", "!",
        "/", "%", "<", ">", "==", "<=",
        ";", ",", "=", "+", "-", "*"];
    let spaceAndLine = ['\n', '\r', '\t', ' '];
    nextCharCounter = charCounter + 1;
    tempLineNumber = lineNumber;
    let token = getToken();
    if (token === '' || token === undefined) {
        checkMainFunctionExists();
        console.log("end of file");
        process.exit(0);
    } else {
        while (spaceAndLine.includes(token)) {
            if (token === '\n') {
                tempLineNumber++;
            }
            token = nextToken();
            if (token === '#') {
                // remove comment line
                token = nextToken();
                while (token !== '\n') {
                    token = nextToken();
                }
                if (token === '\n') {
                    tempLineNumber++;
                }
                token = nextToken();
            }
            if (token === '' || token === undefined) {
                checkMainFunctionExists();
                console.log("end of file");
                process.exit(0);
            }
        }
        if (token === '#') {
            // remove comment line
            token = nextToken();
            while (token !== '\n') {
                token = nextToken();
            }
            if (token === '\n') {
                tempLineNumber++;
            }
            token = nextToken();
        }
        do {
            let nextChar = nextToken();
            if (nextChar === "" ||
                nextChar === undefined ||
                spaceAndLine.includes(nextChar) ||
                (signs.includes(nextChar) && !signs.includes(token + nextChar)) ||
                signs.includes(token) && !signs.includes(token + nextChar)) {
                break;
            }
            token += nextChar;
        } while (true);

        jumpCharCounter = nextCharCounter - 1;
        if (drop) {
            dropToken();
            lineNumber = tempLineNumber;
        }
        return token;
    }
}

function checkMainFunctionExists() {
    let getMainFunc = getFromSymbolTable('main', 1);
    if (getMainFunc === null) {
        console.error('no main function exist');
    }
}

function getToken() {
    return inputFile[charCounter];
}

function nextToken() {
    return inputFile[nextCharCounter++];
}

function dropToken() {
    charCounter = jumpCharCounter;
    lineNumber = tempLineNumber;
}

function Reg(number) {
    if (number) {
        return `r${number}`;
    }
    return `r${regCounter++}`;
}

function makeRegForConst(number, dropAfter = true, iden = '') {
    let temp = Reg();
    console.log(`\t mov   ${temp}, ${number}`);
    if (!dropAfter) {
        putInRegTable(temp, iden);
    } else {
        regCounter--;
    }
    return temp;
}

function Label() {
    return `L${labelCounter++}`;
}
