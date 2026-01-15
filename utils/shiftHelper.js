function getShiftDate(date = new Date()) {
    const currentHour = date.getHours();
    const shiftDate = new Date(date);

    if (currentHour < 7) {
        shiftDate.setDate(shiftDate.getDate() - 1);
    }

    shiftDate.setHours(0, 0, 0, 0);
    return shiftDate;
}

module.exports = { getShiftDate };
