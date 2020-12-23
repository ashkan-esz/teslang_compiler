const fs = require('fs');
const inputFile = fs.readFileSync("./input.txt", 'utf8');
let lineNumber = 1;
let tempLineNumber = 0;
let charCounter = 0;
let nextCharCounter = 0;
let jumpCharCounter = 0;
let symbolTable = [];
let token;
let scope = 1;
let hasMain = false;
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
                                dropScopeTables(scope);
                                scope--;
                                if (!hasMain) {
                                    let getMainFunc = getFromSymbolTable('main', 1);
                                    if (getMainFunc === null) {
                                        console.error('cannot find function main ,it should be the first function');
                                    }
                                    hasMain = true;// print error only once
                                }
                                console.log('function scope variables dropped');
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
    let result = expr();
    let returnType = result === null ? null :
        typeof result === 'number' ? 'num' :
            result.type === 'func' ? result.returnType :
                (result.type === 'list' && result.index && result.index.length > 0) ? 'num' :
                    result.type;

    let value;
    if (result === null) {
        value = null;
    } else if (typeof result === 'number') {
        value = result;
    } else if (result.type === 'func') {
        value = [0];
    } else if (result.type === 'num') {
        value = result.value;
    } else {
        if (result.index && result.index.length > 0) {
            let index = result.index.pop();
            if (index >= result.value.length) {
                console.error(`${lineNumber} : ${index} ,out of list length index `);
                value = undefined;
            } else {
                value = result.value[index];
            }
        } else {
            value = result.value;
        }
    }

    if (returnType && returnType === 'list') {
        console.log(`return([${value}])`);
    } else {
        console.log(`return(${value})`);
    }
    if (token === ';') {

        if (returnType !== null) {
            let thisFunction = getThisFunctionTable();
            let funcReturnType = thisFunction.returnType;
            if (funcReturnType === 'nil') {
                console.error(`${lineNumber} : return type of function ${thisFunction.name} is nil and cannot have return`);
            } else if (funcReturnType !== returnType) {
                console.error(`${lineNumber} : return type of function ${thisFunction.name} is ${funcReturnType}, but got ${returnType}`);
            }
        } else {
            console.error(`${lineNumber} : function return type cannot be null`);
        }
    } else {
        console.error(`${lineNumber} : ; is missed`);
    }
}

function stmtIF() {
    token = getNextToken();
    if (token === '(') {
        token = getNextToken();
        let result = expr();
        if (token === ')') {
            token = getNextToken();
            stmt();
            if (getNextToken(false) === 'else') {
                dropToken();
                token = getNextToken();
                stmt();
            }
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
        token = getNextToken();
        let result = expr();
        if (token === ')') {
            token = getNextToken();
            stmt();
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
                putInSymbolTable(counterName, 'num', scope);
                token = getNextToken();
                if (token === 'in') {
                    token = getNextToken();
                    let result = expr();
                    if (token === ')') {
                        token = getNextToken();
                        stmt();
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
        putInSymbolTable(token, type, scope, 0);
    } else {
        console.error(`${lineNumber} : variable ${token} already exist`);
    }
}

function expr() {
    let finalResult = expr0();
    while (token === '&&' || token === '||') {
        let operator = token;
        token = getNextToken();
        let exprRes2 = expr0();
        if (operator === '&&') {
            finalResult = finalResult && exprRes2;
        } else if (operator === '||') {
            finalResult = finalResult || exprRes2;
        } else {
            console.error(`${lineNumber} : ${operator} ,invalid operator`);
            finalResult = false;
        }
    }
    return finalResult;
}

function expr0() {
    let operations = ['=', '>', '>=', '==', '!=', '<', '<='];
    let finalResult = expr1();
    while (operations.includes(token)) {
        let operator = token;
        token = getNextToken();
        let exprRes2 = expr1();
        if (operator === '=') {
            assignOperationAction(finalResult, exprRes2);
        } else if (operator === '>') {
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 > result.value2);
        } else if (operator === '>=') {
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 >= result.value2);
        } else if (operator === '==') {
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 === result.value2);
        } else if (operator === '!=') {
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 !== result.value2);
        } else if (operator === '<') {
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 < result.value2);
        } else if (operator === '<=') {
            let result = handleIdentifierCheck(finalResult, exprRes2);
            finalResult = (result === null) ? false : (result.value1 <= result.value2);
        } else {
            console.error(`${lineNumber} : ${operator} ,invalid operator`);
            finalResult = false;
        }
    }
    return finalResult;
}

function assignOperationAction(exprRes1, exprRes2) {
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
                    value2 = [0]; //return value for func is 0
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
        console.error(`${lineNumber} : there is error on right side of assign operator`);
        return;
    }

    if (valueType1 === valueType2) {
        //makelist : inner function
        if (exprRes2 &&
            exprRes2.name === 'makelist' &&
            exprRes2.callValues.length === 1) {
            let listSize = exprRes2.callValues[0];
            exprRes1.value = Array(listSize).fill(0);
        } else {
            exprRes1.value = value2;
        }
    } else {
        if (valueType1 === 'list' && exprRes1.index && exprRes1.index.length > 0 && valueType2 === 'num') {
            let index = exprRes1.index.pop();
            if (index >= exprRes1.value.length) {
                console.error(`${lineNumber} : ${index} ,out of list length index on left side of assign operator `);
            } else {
                exprRes1.value[index] = value2;
            }
        } else {
            console.error(`${lineNumber} : cannot put data of type :${valueType2} into variable of type :${valueType1}`);
        }
    }
}

function expr1() {
    let finalResult = expr2();
    while (token === '+') {
        token = getNextToken();
        let exprRes2 = expr2();
        let res = handleIdentifierCheck(finalResult, exprRes2);
        if (res !== null) {
            finalResult = (res.value1 + res.value2);
        } else {
            finalResult = null;
        }
    }
    return finalResult;
}

function expr2() {
    let finalResult = expr3();
    while (token === '-') {
        token = getNextToken();
        let exprRes2 = expr3();
        let res = handleIdentifierCheck(finalResult, exprRes2);
        if (res !== null) {
            finalResult = (res.value1 - res.value2);
        } else {
            finalResult = null;
        }
    }
    return finalResult;
}

function expr3() {
    let finalResult = expr4();
    while (token === '*') {
        token = getNextToken();
        let exprRes2 = expr4();
        let res = handleIdentifierCheck(finalResult, exprRes2);
        if (res !== null) {
            finalResult = (res.value1 * res.value2);
        } else {
            finalResult = null;
        }
    }
    return finalResult;
}

function expr4() {
    let finalResult = expr5();
    while (token === '/') {
        token = getNextToken();
        let exprRes2 = expr5();
        let res = handleIdentifierCheck(finalResult, exprRes2);
        if (res !== null) {
            finalResult = (res.value1 / res.value2);
        } else {
            finalResult = null;
        }
    }
    return finalResult;
}

function expr5() {
    let finalResult = expr6();
    while (token === '%') {
        token = getNextToken();
        let exprRes2 = expr6();
        let res = handleIdentifierCheck(finalResult, exprRes2);
        if (res !== null) {
            finalResult = (res.value1 % res.value2);
        } else {
            finalResult = null;
        }
    }
    return finalResult;
}

function handleIdentifierCheck(exprRes1, exprRes2) {
    let type1 = typeof exprRes1;
    let type2 = typeof exprRes2;
    let value1 = exprRes1;
    let value2 = exprRes2;
    let valueType1, valueType2;
    //--- null means error or not defined function // string means not defined variable
    if (exprRes1 !== null && exprRes2 !== null && type1 !== 'string' && type2 !== 'string') {
        if (type1 === 'object') {
            if (exprRes1.type === 'func') {
                if (exprRes1.returnType === 'nil') {
                    value1 = null; // this function is type of void and doesnt return value
                    valueType1 = null;
                } else {
                    value1 = 0;//return value for func is 0
                    valueType1 = exprRes1.returnType;
                }
            } else {
                if (exprRes1.type === 'list' && exprRes1.index && exprRes1.index.length > 0) {
                    let index = exprRes1.index.pop();
                    if (index >= exprRes1.value.length) {
                        console.error(`${lineNumber} : ${index} ,out of list length index `);
                        value1 = null;
                        valueType1 = null;
                    } else {
                        value1 = exprRes1.value[index];
                        valueType1 = 'num';
                    }
                } else {
                    value1 = exprRes1.value;
                    valueType1 = exprRes1.type;
                }
            }
        } else if (type1 === 'number') {
            value1 = exprRes1;
            valueType1 = 'num';
        }


        if (type2 === 'object') {
            if (exprRes2.type === 'func') {
                if (exprRes2.returnType === 'nil') {
                    value2 = null; // this function is type of void and doesnt return value
                    valueType2 = null;
                } else {
                    value2 = 0; //return value for func is 0
                    valueType2 = exprRes2.returnType;
                }
            } else {
                if (exprRes2.type === 'list' && exprRes2.index && exprRes2.index.length > 0) {
                    let index = exprRes2.index.pop();
                    if (index >= exprRes2.value.length) {
                        console.error(`${lineNumber} : ${index} ,out of list length index `);
                        value2 = null;
                        valueType2 = null;
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

function expr6() {
    // return  number | symbolTable | string (new var) | null (not found func | error)
    if (isWord(token)) {
        let variableName = token;
        token = getNextToken();
        if (token === '(') { // iden (expr)
            return handleClistCall(variableName)
        } else if (token === '[') { // iden [expr]
            return exprExpr(variableName)
        } else {
            let searchResult = getFromSymbolTable(variableName, scope);
            if (searchResult !== null) {
                delete searchResult.index;
                return searchResult;
            } else {
                console.error(`${lineNumber} : variable ${variableName} doesnt exists`);
                return variableName;
            }
        }
    } else if (isNumber(token)) {// number
        let number = token;
        token = getNextToken();
        return Number(number);
    } else if (token === '!') { // !expr
        token = getNextToken();
        return !expr();
    } else if (token === '-') {// -expr
        token = getNextToken();
        return -expr();
    } else if (token === '+') { // +expr
        token = getNextToken();
        return +expr();
    } else if (token === '(') { // (expr)
        token = getNextToken();
        let exprRes1 = expr();
        if (token === ')') {
            token = getNextToken();
            return exprRes1;
        } else {
            console.error(`${lineNumber} : ) is missed`);
            return null;
        }
    } else if (isKeyword(token)) {
        console.error(`${lineNumber} : ${token} ,cannot redefine key words`);
        return null;
    } else {
        console.error(`${lineNumber} : ${token} syntax error`);
        return null;
    }
}

function exprExpr(variableName) {
    let searchResult = getFromSymbolTable(variableName, scope);
    if (searchResult && searchResult.index === undefined) {
        searchResult.index = [];
    }
    if (searchResult === null) {
        console.error(`${lineNumber} : variable ${variableName} doesnt exists`);
        return null;
    } else if (searchResult.type !== 'list') {
        console.error(`${lineNumber} : expected ${variableName} to be of type list not ${searchResult.type}`);
        return null;
    }

    if (token === '[') {
        token = getNextToken();
        let exprRes1 = expr();
        if (typeof exprRes1 === 'number') {
            searchResult.index.push(exprRes1);
        } else if (typeof exprRes1 === 'object') {
            if (exprRes1.type === 'func') {
                if (exprRes1.returnType === 'nil') {
                    console.error(`${lineNumber} : return type of function ${exprRes1.name} is nil and doesnt have return value`);
                    return null;
                } else if (exprRes1.returnType === 'num') {
                    searchResult.index.push(0);
                } else {
                    console.error(`${lineNumber} : function ${exprRes1.type} error`);
                    return null;
                }
            } else if (exprRes1.type === 'num') {
                searchResult.index.push(exprRes1.value);
            } else {
                console.error(`${lineNumber} : expected ${exprRes1.name} to be of type num`);
                return null;
            }
        } else {
            console.error(`${lineNumber} : ${variableName} error`);
            return null;
        }

        if (token === ']') {
            token = getNextToken();
            return searchResult;
        } else {
            console.error(`${lineNumber} : ] is missed`);
            return null;
        }
    } else {
        console.error(`${lineNumber} : [ is missed`);
        return null;
    }
}

function handleClistCall(variableName) {
    let funcReturnType = null;
    let funcArgs = [];
    let searchResult = getFromSymbolTable(variableName, scope);
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
            console.error(`${lineNumber} : expected ${variableName} to be function not ${searchResult.type}`);
            searchResult = null;
        }
    } else {
        console.error(`${lineNumber} : function ${variableName} doesnt exists`);
        searchResult = null;
    }
    token = getNextToken();
    let types = clist(searchResult);
    if (token === ')') {
        token = getNextToken();
        if (funcReturnType) {
            if (types.length === funcArgs.length) {
                for (let i = 0; i < funcArgs.length; i++) {
                    if (funcArgs[i] !== types[i]) {
                        console.error(`${lineNumber} : function ${variableName} expected ${funcArgs[i]} arg type , got ${types[i]}`);
                        return null;
                    }
                }
            } else {
                console.error(`${lineNumber} : function ${variableName} expected ${funcArgs.length} args , got ${types.length}`);
                return null;
            }
        }

        return searchResult;
    } else {
        console.error(`${lineNumber} : ) is missed`);
        return null;
    }
}

function flist(funcArgTypes) {
    let typeResult = type();
    if (typeResult !== null) {
        token = getNextToken();
        if (isWord(token)) {
            funcArgTypes.push(typeResult);
            putInSymbolTable(token, typeResult, scope);
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
    let valueType1, valueType2;
    let callValues = [];
    let types = [];
    if (token === ')') {
        return [];
    }
    let exprRes1 = expr();
    if (exprRes1 === null) {
        return [];
    }
    let type1 = typeof exprRes1;
    if (type1 === 'object') {
        if (exprRes1.type === 'func') {
            if (exprRes1.returnType === 'nil') {
                valueType1 = null;
                types.push(valueType1);
                callValues.push(0);
            } else {
                valueType1 = exprRes1.returnType;
                types.push(valueType1);
                callValues.push(0);
            }
        } else {
            valueType1 = exprRes1.type;
            types.push(valueType1);
            callValues.push(exprRes1.value);
        }
    } else if (type1 === 'number') {
        types.push('num');
        callValues.push(exprRes1);
    } else {
        types.push(null);
        callValues.push(null);
    }

    while (token === ',') {
        token = getNextToken();
        let exprRes2 = expr();

        let type2 = typeof exprRes2;
        if (type2 === 'object') {
            if (exprRes2.type === 'func') {
                if (exprRes2.returnType === 'nil') {
                    valueType2 = null;
                    types.push(valueType2);
                    callValues.push(0);
                } else {
                    valueType2 = exprRes2.returnType;
                    types.push(valueType2);
                    callValues.push(0);
                }
            } else {
                valueType2 = exprRes2.type;
                types.push(valueType2);
                callValues.push(exprRes2.value);
            }
        } else if (type2 === 'number') {
            types.push('num');
            callValues.push(exprRes2);
        } else {
            types.push(null);
            callValues.push(null);
        }

    }
    if (searchResult !== null) {
        searchResult.callValues = callValues;
    }
    return types;
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
        value: (type === 'list') ? [value] : value,
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
    } else {
        symbolTable = symbolTable.filter((thisTable) => thisTable.scope < scope);
    }
}

function dropIdentifier(name) {
    symbolTable = symbolTable.filter((thisTable) => thisTable.name !== name);
}

function createSymbolTable() {
    let numread = {
        name: 'numread',
        type: 'func',
        scope: 1,
        args: [],
        returnType: 'num',
    };
    let numprint = {
        name: 'numprint',
        type: 'func',
        scope: 1,
        args: ['num'],
        returnType: 'nil',
    };
    let makelist = {
        name: 'makelist',
        type: 'func',
        scope: 1,
        args: ['num'],
        returnType: 'list'
    }
    let listlen = {
        name: 'listlen',
        type: 'func',
        scope: 1,
        args: ['list'],
        returnType: 'num'
    }
    let exit = {
        name: 'exit',
        type: 'func',
        scope: 1,
        args: ['num'],
        returnType: 'nil',
    }

    symbolTable.push(numread);
    symbolTable.push(numprint);
    symbolTable.push(makelist);
    symbolTable.push(listlen);
    symbolTable.push(exit);
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
                token = nextToken();
            }
            if (token === '' || token === undefined) {
                console.log("end of file");
                process.exit(0);
            }
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

function printSymbolTable() {
    console.log(symbolTable);
}
