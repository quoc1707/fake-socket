// @ts-nocheck

interface IMessage {
    type: string
    action: string
    id: string
    content?: string
    messages?: IMessage[]
}

interface String {
    isMessageId(): boolean
    isLink(): boolean
    toCapitalized(locale?: string): string
}

interface Array<T> {
    excludeProperty(prop: string, value: string): IMessage[]
    filterDuplicatedElement(prop: string): IMessage[]
    handleIncorrectType(
        prop: string,
        oldValue: string,
        newValue: string,
        regex: string
    ): IMessage[]
}

let allMessages: IMessage[] = []

String.prototype.toCapitalized = function (locale = navigator.language) {
    return this.charAt(0).toLocaleUpperCase(locale) + this.slice(1)
}

String.prototype.isMessageId = function () {
    return this.startsWith('mid.$')
}

String.prototype.isLink = function () {
    return this.startsWith('https://')
}

Array.prototype.excludeProperty = function (prop, value) {
    let items = [...this]

    items = items.filter((el) => el[prop] !== value)

    return items
}

Array.prototype.filterDuplicatedElement = function (prop) {
    let items = [...this]

    for (let i = items.length - 1; i > 0; i--) {
        if (i <= items.length) {
            if (items[i][prop] === items[i - 1][prop]) items.splice(i, 1)
        }
    }

    items = Array.from(new Set(items))

    return items
}

Array.prototype.handleIncorrectType = function (
    prop: string,
    oldValue: string,
    newValue: string,
    regex: string
) {
    let items = [...this]

    items = items
        .filter((el) => el[prop] === oldValue)
        .map((el) => {
            return el[prop].includes(regex) ? { ...el, [prop]: newValue } : el
        })

    return items
}

const logText = (
    text: string,
    textColor = '#191414',
    backgroundColor = '#1db954'
) => {
    console.log(
        `%c${text}`,
        `color: ${textColor}; background: ${backgroundColor}`
    )
}

const parse = (text: string) => {
    let returnString = text
    let limit = 10

    while (--limit > 0) {
        try {
            returnString[0] === '"'
                ? (returnString = JSON.parse(returnString))
                : (returnString = JSON.parse(`"${returnString}"`))
        } catch (e) {
            break
        }
    }

    return returnString
}

const processChunk = (chunk: MessageEvent) => {
    const utf8String = new TextDecoder('utf-8').decode(chunk.data)

    if (
        utf8String[0] === '1' ||
        utf8String[0] === '2' ||
        utf8String[0] === '3'
    ) {
        const allStringRegex = /(\\\")(.*?)(\\\")(?=[,)])/g
        let allString = (utf8String.match(allStringRegex) || []).map((text) =>
            parse(text)
        )
        let chat = []

        for (let i = 0; i < allString.length; i++) {
            const str_i = allString[i]

            if (str_i === 'insertMessage' && allString[i + 2].isMessageId()) {
                const content = allString[i + 1]
                if (content)
                    chat.push({
                        type: 'text',
                        action: 'send',
                        id: allString[i + 2],
                        content,
                    })
            }

            if (str_i === 'insertBlobAttachment' && allString[i + 2].isLink()) {
                const isImage =
                        allString[i + 1]?.startsWith('image-') ||
                        allString[i + 1]?.startsWith('gif-'),
                    isVideo = allString[i + 1]?.startsWith('video-'),
                    isAudio = allString[i + 1]?.startsWith('audioclip-'),
                    type = isImage
                        ? 'image'
                        : isVideo
                        ? 'video'
                        : isAudio
                        ? 'audio'
                        : 'attachment'

                for (let j = i; j < allString.length - 1; j++) {
                    if (allString[j].isMessageId()) {
                        chat.push({
                            type,
                            action: 'send',
                            id: allString[j],
                            content: allString[i + 2],
                        })
                        break
                    }
                }
            }

            if (
                str_i === 'insertMessage' &&
                allString[i + 1].isMessageId() &&
                allString[i + 6].isLink()
            )
                chat.push({
                    type: 'sticker',
                    action: 'send',
                    id: allString[i + 1],
                    content: allString[i + 6],
                })

            if (str_i === 'upsertReaction' && allString[i + 1].isMessageId())
                chat.push({
                    type: 'reaction',
                    action: 'add',
                    id: allString[i + 1],
                    content: allString[i + 2],
                })

            if (str_i === 'deleteReaction' && allString[i + 1].isMessageId())
                chat.push({
                    type: 'reaction',
                    action: 'remove',
                    id: allString[i + 1],
                    content:
                        allMessages.find((c) => c.id === allString[i + 1])
                            ?.content || '',
                })

            if (
                str_i === 'xma_live_location_sharing' &&
                allString[i - 2].isMessageId() &&
                allString[i + 1].isLink()
            )
                chat.push({
                    type: 'location',
                    action: 'share',
                    id: allString[i - 2],
                    content: allString[i + 1],
                })

            if (
                str_i === 'deleteThenInsertMessage' &&
                allString[i + 2].isMessageId()
            )
                chat.push({
                    type: 'unknown',
                    action: 'unsend',
                    id: allString[i + 2],
                    messages:
                        allMessages.filter(
                            (c) =>
                                c.id === allString[i + 2] &&
                                c.type !== 'unknown'
                        ) || [],
                })
        }

        for (let c of chat) {
            let isDuplicated =
                -1 !==
                allMessages.findIndex(
                    (_msg) => JSON.stringify(c) === JSON.stringify(_msg)
                )

            if (!isDuplicated) {
                allMessages = allMessages.concat(chat)

                const { type, action, content } = c

                if (type === 'unknown') {
                    const messages = c.messages!
                    logText(
                        `> ${action.toCapitalized()} message: ${
                            messages[messages.length - 1].content
                                ? messages[messages.length - 1].content
                                : 'No data available.'
                        }`,
                        '#191414',
                        '#f35369'
                    )
                } else if (type === 'sticker') {
                    let modifiedType = ''

                    if (content?.includes('https://scontent.xx.fbcdn.net'))
                        modifiedType = 'image'
                    else if (content?.includes('https://video.xx.fbcdn.net'))
                        modifiedType = 'video'
                    else if (content?.includes('https://cdn.fbsbx.com'))
                        modifiedType = 'audio'

                    logText(
                        `> ${action.toCapitalized()} ${modifiedType}: ${content}`
                    )
                } else
                    logText(`> ${action.toCapitalized()} ${type}: ${content}`)
            }
        }
    }
}

;(() => {
    allMessages = JSON.parse(localStorage.allMessages || '[]')

    logText(`Load ${allMessages.length} message(s)`)

    window.addEventListener('beforeunload', () => {
        allMessages = allMessages
            .excludeProperty('type', 'unknown')
            .filterDuplicatedElement('id')
            .handleIncorrectType(
                'type',
                'sticker',
                'image',
                'https://scontent.xx.fbcdn.net'
            )
            .handleIncorrectType(
                'type',
                'sticker',
                'video',
                'https://video.xx.fbcdn.net'
            )
            .handleIncorrectType(
                'type',
                'sticker',
                'audio',
                'https://cdn.fbsbx.com'
            )
        localStorage.setItem('allMessages', JSON.stringify(allMessages))
    })

    const original_WebSocket = window.WebSocket

    window.WebSocket = function fakeConstructor(
        url: string | URL,
        protocols: string
    ) {
        const websocket_instant = new original_WebSocket(url, protocols)

        websocket_instant.addEventListener('message', processChunk)

        return websocket_instant
    }

    window.WebSocket.prototype = original_WebSocket.prototype
    window.WebSocket.prototype.constructor = window.WebSocket
})()
