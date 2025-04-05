/// <reference path="../../../types.ts" />
if (!this.messages) {
    this.messages = []
}

if (post.message) {
    this.messages.push(`<bubble type="out">
        <img src="/images/john.jpg" circle="true" />
        <title>me</title>
        ${post.message}
    </bubble>`)
}

