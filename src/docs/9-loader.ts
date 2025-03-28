/// <reference path="../../types.ts" />


console.log('INISDE 9-loader.ts')

// this is a script for 9-loader.tkml
// means that this script is executed when the page is loaded
let time = 'generated at ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
if (parseInt(get.next)) {
    console.log('next is set')
    let code = ''
    for (let i = 0; i < 20; i++) {
        code += `<section>Item ${i + parseInt(get.next)}: Extended Content ${time}</section>`
    }
    code += `<loader href="./9-loader.tkml?next=${parseInt(get.next) + 20}" />`
    finish(code)
} else {
    console.log("not found", get)
}