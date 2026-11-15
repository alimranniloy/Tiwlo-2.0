package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Reply
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.AttachFile
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.AppScreen
import com.example.model.EmailMessage
import com.example.ui.components.CardHeader
import com.example.ui.components.DashboardShell
import com.example.ui.components.PageHeader
import com.example.ui.components.ShadcnCard
import com.example.ui.components.ShadcnInput
import com.example.ui.components.ShadcnOutlineButton
import com.example.ui.components.ShadcnPrimaryButton
import com.example.ui.components.StatusPill
import com.example.ui.components.StatusTone
import com.example.ui.theme.FigtreeFontFamily
import com.example.ui.theme.JetBrainsMonoFontFamily
import com.example.ui.theme.ShadcnAmber
import com.example.ui.theme.ShadcnBackground
import com.example.ui.theme.ShadcnBorder
import com.example.ui.theme.ShadcnForeground
import com.example.ui.theme.ShadcnInk
import com.example.ui.theme.ShadcnMuted
import com.example.ui.theme.ShadcnMutedForeground
import com.example.ui.theme.ShadcnPrimary
import com.example.viewmodel.TiwloUiState

/**
 * Tiwlo Mail Screen (`AppScreen.EMAIL`)
 * Pure shadcn UI — NO dark ring card!
 */
@Composable
fun MailScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onSelectFolder: (String) -> Unit,
    onSelectCategory: (String) -> Unit,
    onSearchQueryChange: (String) -> Unit,
    onSelectEmail: (String) -> Unit,
    onToggleStar: (String) -> Unit,
    onDeleteEmail: (String) -> Unit,
    onOpenCompose: () -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    var readingMessageId by remember { mutableStateOf<String?>(null) }

    val filteredEmails = remember(
        uiState.emails,
        uiState.selectedMailFolder,
        uiState.selectedMailCategory,
        uiState.mailSearchQuery
    ) {
        uiState.emails.filter { email ->
            val folderMatch = when (uiState.selectedMailFolder) {
                "Starred" -> email.starred
                "All Mail" -> true
                else -> email.folder.equals(uiState.selectedMailFolder, ignoreCase = true)
            }
            val categoryMatch = uiState.selectedMailCategory == "All" ||
                email.category.equals(uiState.selectedMailCategory, ignoreCase = true)
            val queryMatch = uiState.mailSearchQuery.isBlank() ||
                email.subject.contains(uiState.mailSearchQuery, ignoreCase = true) ||
                email.sender.contains(uiState.mailSearchQuery, ignoreCase = true) ||
                email.preview.contains(uiState.mailSearchQuery, ignoreCase = true)
            folderMatch && categoryMatch && queryMatch
        }
    }

    val activeReadingEmail = uiState.emails.firstOrNull { it.id == readingMessageId }

    DashboardShell(
        currentScreen = AppScreen.EMAIL,
        screenTitle = if (activeReadingEmail != null) "Read Message" else "Tiwi Mail",
        screenSubtitle = if (activeReadingEmail != null) {
            activeReadingEmail.senderEmail
        } else {
            uiState.mailboxAddress.ifBlank { "No Tiwi Mailbox" }
        },
        isSubPage = activeReadingEmail != null,
        onBackClick = { readingMessageId = null },
        unreadNotificationCount = uiState.notifications.count { it.unread },
        notifications = uiState.notifications,
        onNavigate = onNavigate,
        onMarkAllNotificationsRead = onMarkAllNotificationsRead,
        onNotificationClick = onNotificationClick
    ) { innerPadding ->
        if (activeReadingEmail != null) {
            MobileEmailReadingPage(
                email = activeReadingEmail,
                onToggleStar = { onToggleStar(activeReadingEmail.id) },
                onDelete = {
                    onDeleteEmail(activeReadingEmail.id)
                    readingMessageId = null
                },
                onReply = onOpenCompose,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                PageHeader(
                    title = "Tiwi Mail Inbox",
                    subtitle = uiState.mailboxAddress.ifBlank { "No Tiwi Mailbox configured" },
                ) {
                    ShadcnPrimaryButton(
                        text = "Compose Message",
                        icon = Icons.Outlined.Edit,
                        onClick = onOpenCompose,
                        modifier = Modifier.testTag("mail_compose_button")
                    )
                }

                ShadcnInput(
                    value = uiState.mailSearchQuery,
                    onValueChange = onSearchQueryChange,
                    placeholder = "Search messages, senders, or domains...",
                    leadingIcon = Icons.Outlined.Search,
                    testTag = "mail_search_input"
                )

                // Folder Chips
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val folders = listOf("Inbox", "Starred", "Sent", "Drafts", "All Mail")
                    folders.forEach { folder ->
                        val active = uiState.selectedMailFolder == folder
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (active) ShadcnInk else ShadcnBackground)
                                .border(
                                    1.dp,
                                    if (active) ShadcnInk else ShadcnBorder,
                                    RoundedCornerShape(50)
                                )
                                .clickable { onSelectFolder(folder) }
                                .padding(horizontal = 14.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = folder,
                                fontFamily = FigtreeFontFamily,
                                fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 12.sp,
                                color = if (active) Color.White else ShadcnForeground
                            )
                        }
                    }
                }

                // Category Chips
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("All", "Primary", "Updates", "Promotions").forEach { cat ->
                        val active = uiState.selectedMailCategory == cat
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (active) ShadcnPrimary.copy(alpha = 0.16f) else ShadcnMuted)
                                .clickable { onSelectCategory(cat) }
                                .padding(horizontal = 11.dp, vertical = 5.dp)
                        ) {
                            Text(
                                text = cat,
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 11.sp,
                                color = ShadcnForeground
                            )
                        }
                    }
                }

                // Message Cards
                ShadcnCard {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        if (filteredEmails.isEmpty()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "No messages in ${uiState.selectedMailFolder}",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 13.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                        } else {
                            filteredEmails.forEachIndexed { idx, email ->
                                EmailMobileRow(
                                    email = email,
                                    onClick = {
                                        onSelectEmail(email.id)
                                        readingMessageId = email.id
                                    },
                                    onToggleStar = { onToggleStar(email.id) }
                                )
                                if (idx < filteredEmails.lastIndex) {
                                    HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmailMobileRow(
    email: EmailMessage,
    onClick: () -> Unit,
    onToggleStar: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (email.unread) ShadcnPrimary.copy(alpha = 0.06f) else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 13.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(if (email.unread) ShadcnInk else ShadcnMuted),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = email.avatar,
                fontFamily = FigtreeFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                color = if (email.unread) ShadcnPrimary else ShadcnForeground
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = email.sender,
                    fontFamily = FigtreeFontFamily,
                    fontWeight = if (email.unread) FontWeight.Bold else FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = ShadcnForeground,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = email.time,
                    fontFamily = JetBrainsMonoFontFamily,
                    fontSize = 10.sp,
                    color = ShadcnMutedForeground
                )
            }
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = email.subject,
                fontFamily = FigtreeFontFamily,
                fontWeight = if (email.unread) FontWeight.SemiBold else FontWeight.Medium,
                fontSize = 13.sp,
                color = ShadcnForeground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = email.preview,
                fontFamily = FigtreeFontFamily,
                fontSize = 12.sp,
                color = ShadcnMutedForeground,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }

        Icon(
            imageVector = if (email.starred) Icons.Outlined.Star else Icons.Outlined.StarBorder,
            contentDescription = "Star",
            tint = if (email.starred) ShadcnAmber else ShadcnMutedForeground,
            modifier = Modifier
                .size(18.dp)
                .clickable(onClick = onToggleStar)
        )
    }
}

@Composable
private fun MobileEmailReadingPage(
    email: EmailMessage,
    onToggleStar: () -> Unit,
    onDelete: () -> Unit,
    onReply: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ShadcnCard {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Text(
                        text = email.subject,
                        fontFamily = FigtreeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = ShadcnForeground,
                        modifier = Modifier.weight(1f)
                    )
                    Icon(
                        imageVector = if (email.starred) Icons.Outlined.Star else Icons.Outlined.StarBorder,
                        contentDescription = "Star",
                        tint = if (email.starred) ShadcnAmber else ShadcnMutedForeground,
                        modifier = Modifier
                            .size(20.dp)
                            .clickable(onClick = onToggleStar)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = email.sender,
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = ShadcnForeground
                        )
                        Text(
                            text = "<${email.senderEmail}> · ${email.date}",
                            fontFamily = JetBrainsMonoFontFamily,
                            fontSize = 11.sp,
                            color = ShadcnMutedForeground
                        )
                    }
                    StatusPill(text = email.category, tone = StatusTone.BLUE)
                }

                HorizontalDivider(color = ShadcnBorder)

                email.body.forEach { paragraph ->
                    Text(
                        text = paragraph,
                        fontFamily = FigtreeFontFamily,
                        fontSize = 14.sp,
                        color = ShadcnForeground,
                        lineHeight = 21.sp
                    )
                }

                if (email.attachments.isNotEmpty()) {
                    HorizontalDivider(color = ShadcnBorder)
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        email.attachments.forEach { att ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(ShadcnMuted)
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.AttachFile,
                                        contentDescription = att.name,
                                        tint = ShadcnForeground,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Text(
                                        text = att.name,
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontSize = 12.sp,
                                        color = ShadcnForeground
                                    )
                                }
                                Text(
                                    text = att.size,
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontSize = 11.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    ShadcnPrimaryButton(
                        text = "Reply",
                        icon = Icons.AutoMirrored.Outlined.Reply,
                        onClick = onReply,
                        modifier = Modifier.weight(1f)
                    )
                    ShadcnOutlineButton(
                        text = "Delete",
                        icon = Icons.Outlined.DeleteOutline,
                        onClick = onDelete,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

/**
 * Compose New Email Full-Screen Mobile Page (`AppScreen.EMAIL_COMPOSE`)
 * Pure shadcn UI — NO dark ring card! Includes mobile Back button (`<-`).
 */
@Composable
fun MailComposeScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSendEmail: (String, String, String) -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    var toEmail by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }

    DashboardShell(
        currentScreen = AppScreen.EMAIL_COMPOSE,
        screenTitle = "Compose Email",
        screenSubtitle = "From: ${uiState.mailboxAddress.ifBlank { "No Tiwi Mailbox" }}",
        isSubPage = true,
        onBackClick = onBack,
        unreadNotificationCount = uiState.notifications.count { it.unread },
        notifications = uiState.notifications,
        onNavigate = onNavigate,
        onMarkAllNotificationsRead = onMarkAllNotificationsRead,
        onNotificationClick = onNotificationClick
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            ShadcnCard {
                CardHeader(
                    title = "New Message",
                    description = "Send via DKIM-signed Tiwi Mail relay"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ShadcnInput(
                        value = toEmail,
                        onValueChange = { toEmail = it },
                        placeholder = "To: recipient@company.com",
                        testTag = "compose_to_input"
                    )
                    ShadcnInput(
                        value = subject,
                        onValueChange = { subject = it },
                        placeholder = "Subject",
                        testTag = "compose_subject_input"
                    )
                    ShadcnInput(
                        value = body,
                        onValueChange = { body = it },
                        placeholder = "Write your message...",
                        singleLine = false,
                        modifier = Modifier.height(140.dp),
                        testTag = "compose_body_input"
                    )
                    ShadcnPrimaryButton(
                        text = "Send Email",
                        icon = Icons.AutoMirrored.Outlined.Send,
                        onClick = { onSendEmail(toEmail, subject, body) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("send_email_button")
                    )
                }
            }
        }
    }
}
